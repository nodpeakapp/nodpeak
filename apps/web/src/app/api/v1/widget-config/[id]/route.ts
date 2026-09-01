/**
 * GET /api/v1/widget-config/:id
 *
 * The widget's only load-time request. Returns styling, copy, routing
 * thresholds, the public review wall and the pre-serialized JSON-LD.
 *
 * Public and unauthenticated by design — the project id is visible in every
 * embed snippet, so this endpoint must never return anything the site owner
 * would not already be publishing. Note what is absent: no customer emails,
 * no private reviews, no user record, no webhook URL.
 */

import { prisma } from "@/lib/db";
import { json, fail, preflight } from "@/lib/http";
import { buildAggregateRatingSchema, aggregate, serializeJsonLd } from "@/lib/schema-generator";
import { googleReviewUrl, trustpilotReviewUrl } from "@/lib/review-links";
import { isWidgetPlacement } from "@/lib/enums";
import { cached, WIDGET_CONFIG_TTL_MS } from "@/lib/response-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function OPTIONS() {
  return preflight();
}

type TrustBarItem = { icon: string; label: string };

function safeJsonArray(raw: string | null | undefined): TrustBarItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is TrustBarItem => typeof x?.label === "string")
      .slice(0, 6)
      .map((x) => ({ icon: typeof x.icon === "string" ? x.icon : "check", label: String(x.label).slice(0, 60) }));
  } catch {
    return [];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  if (!projectId || projectId.length > 64) return fail("Invalid project id", 400);

  // This endpoint is called once per page view on every site running the
  // widget, so it must not touch the database that often. See response-cache.ts.
  const payload = await cached(`widget-config:${projectId}`, WIDGET_CONFIG_TTL_MS, async () => {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { widgetConfig: true, siteWidgetConfig: true },
    });
    if (!project) return null;

    const cfg = project.widgetConfig;
    const site = project.siteWidgetConfig;

    const publicReviews = await prisma.review.findMany({
      where: { projectId, isPublic: true, rating: { gte: 1, lte: 5 } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, rating: true, customerName: true, comment: true, createdAt: true },
    });

    // Wall picks from the hand-featured set first, then tops up with the
    // best recent public reviews so a fresh project isn't stuck with an
    // empty wall the moment its first review is approved.
    const featured = await prisma.review.findMany({
      where: { projectId, isPublic: true, featuredForWall: true, comment: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { rating: true, customerName: true, comment: true, createdAt: true },
    });
    const fallbackWall =
      featured.length > 0
        ? []
        : publicReviews
            .filter((r) => r.comment && r.rating >= 4)
            .slice(0, 12)
            .map((r) => ({ rating: r.rating, customerName: r.customerName, comment: r.comment, createdAt: r.createdAt }));

    const stats = aggregate(publicReviews);

    const schema = buildAggregateRatingSchema({
      projectId: project.id,
      name: project.name,
      domain: project.domain,
      reviews: publicReviews,
    });

    return {
      projectId: project.id,
      projectName: project.name,
      domain: project.domain,

      primaryColor: cfg?.primaryColor ?? "#0A0B0D",
      accentColor: cfg?.accentColor ?? "#25D6E8",
      title: cfg?.title ?? "How did we do?",
      subtitle: cfg?.subtitle ?? "Your feedback takes 10 seconds.",
      promptQuestion: cfg?.promptQuestion ?? "Tell us a little more",
      minStarForExternal: cfg?.minStarForExternal ?? 1,
      showSeoBadge: cfg?.showSeoBadge ?? true,
      placement: isWidgetPlacement(cfg?.placement) ? cfg!.placement : "bubble",

      googleReviewUrl: googleReviewUrl(project.googlePlaceId),
      trustpilotReviewUrl: trustpilotReviewUrl(project.trustpilotSlug),

      aggregate: stats.count > 0 ? { count: stats.count, average: stats.average } : null,
      jsonLd: schema ? serializeJsonLd(schema) : null,

      publicReviews: publicReviews.slice(0, 12).map((r) => ({
        rating: r.rating,
        customerName: r.customerName,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
      })),

      wall: (featured.length > 0 ? featured : fallbackWall).map((r) => ({
        rating: r.rating,
        customerName: r.customerName,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
      })),

      // Get-customers / get-trusted site chrome, all driven from the same
      // single config request the widget already makes on load.
      site: {
        announcementEnabled: site?.announcementEnabled ?? false,
        announcementText: site?.announcementText ?? "",
        announcementLinkUrl: site?.announcementLinkUrl ?? null,
        announcementLinkText: site?.announcementLinkText ?? null,
        announcementBg: site?.announcementBg ?? "#25D6E8",
        announcementFg: site?.announcementFg ?? "#0A0B0D",

        whatsappEnabled: site?.whatsappEnabled ?? false,
        whatsappNumber: site?.whatsappNumber ?? null,
        whatsappMessage: site?.whatsappMessage ?? "Hi! I have a question.",

        emailCaptureEnabled: site?.emailCaptureEnabled ?? false,
        emailCaptureTitle: site?.emailCaptureTitle ?? "Get 10% off your first order",
        emailCaptureSubtitle: site?.emailCaptureSubtitle ?? "Join the list — no spam, unsubscribe anytime.",
        emailCaptureDelayMs: site?.emailCaptureDelayMs ?? 4000,

        trustBarEnabled: site?.trustBarEnabled ?? false,
        trustBarItems: safeJsonArray(site?.trustBarItemsJson),

        contactFormEnabled: site?.contactFormEnabled ?? false,
        contactFormTitle: site?.contactFormTitle ?? "Get a quote",
      },
    };
  });

  if (!payload) return fail("Project not found", 404);

  return json(payload, {
    headers: {
      // Short cache: new reviews should show up quickly, but a viral page
      // must not turn into a per-visitor database read.
      "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
