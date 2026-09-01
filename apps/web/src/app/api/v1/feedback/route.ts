/**
 * POST /api/v1/feedback
 *
 * Stores a review, classifies it, and tells the widget where to send the
 * customer next.
 *
 * The routing decision is the whole product, so it is worth being precise
 * about what it is and is not. Every rating is stored — the low ones are the
 * point, they are the ones the owner can act on. What changes with the
 * rating is only whether the customer is *offered* a link to Google or
 * Trustpilot afterwards. Nobody is blocked from reviewing publicly; a
 * one-star customer can walk to Google unaided and frequently does.
 *
 * Reviews are created with isPublic=false. Nothing reaches the public wall or
 * the AggregateRating schema until the owner approves it in the dashboard.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, fail, preflight, clientIp, hashIp } from "@/lib/http";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { classify } from "@/lib/sentiment";
import { googleReviewUrl, trustpilotReviewUrl } from "@/lib/review-links";
import { limitsFor } from "@/lib/enums";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  projectId: z.string().min(1).max(64),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).nullish(),
  customerName: z.string().trim().max(120).nullish(),
  customerEmail: z.string().trim().email().max(200).nullish().or(z.literal("").transform(() => null)),
  sourceUrl: z.string().trim().max(2000).nullish(),
});

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("Malformed JSON body", 400);
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422, {
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  const input = parsed.data;

  const ip = clientIp(req);
  const ipHash = hashIp(ip);

  const gate = rateLimit(`feedback:${ipHash}:${input.projectId}`, LIMITS.feedback);
  if (!gate.allowed) {
    return fail("Too many submissions. Try again later.", 429, {
      retryAfter: gate.retryAfterSeconds,
    });
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { widgetConfig: true, user: { select: { plan: true } } },
  });
  if (!project) return fail("Project not found", 404);

  // Plan ceiling. Enforced here rather than in the widget so it cannot be
  // bypassed by calling the API directly.
  const planLimits = limitsFor(project.user.plan);
  if (Number.isFinite(planLimits.reviews)) {
    const used = await prisma.review.count({ where: { projectId: project.id } });
    if (used >= planLimits.reviews) {
      return fail("This project has reached its review limit.", 402);
    }
  }

  const { sentiment, conflict } = classify(input.rating, input.comment ?? null);

  const review = await prisma.review.create({
    data: {
      projectId: project.id,
      rating: input.rating,
      comment: input.comment?.trim() || null,
      customerName: input.customerName?.trim() || null,
      customerEmail: input.customerEmail?.trim() || null,
      sentiment,
      isPublic: false, // owner approves before anything goes public
      redirectedExternal: false,
      sourceUrl: input.sourceUrl?.slice(0, 2000) || null,
      userAgent: req.headers.get("user-agent")?.slice(0, 400) || null,
      ipHash,
    },
    select: { id: true },
  });

  const threshold = project.widgetConfig?.minStarForExternal ?? 1;
  const offerExternal = input.rating >= threshold;

  const google = offerExternal ? googleReviewUrl(project.googlePlaceId) : null;
  const trustpilot = offerExternal ? trustpilotReviewUrl(project.trustpilotSlug) : null;

  if (google || trustpilot) {
    await prisma.review.update({
      where: { id: review.id },
      data: { redirectedExternal: true },
    });
  }

  // Fire-and-forget outbound webhook. Deliberately not awaited: the customer
  // should never wait on a third-party endpoint, and a slow CRM must not turn
  // into a failed review submission.
  if (project.webhookUrl) {
    void notifyWebhook(project.webhookUrl, {
      event: "review.created",
      projectId: project.id,
      reviewId: review.id,
      rating: input.rating,
      sentiment,
      conflict,
      comment: input.comment ?? null,
      customerName: input.customerName ?? null,
      customerEmail: input.customerEmail ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  return json({
    ok: true,
    reviewId: review.id,
    sentiment,
    redirect: google || trustpilot ? { google, trustpilot } : null,
  });
}

async function notifyWebhook(url: string, payload: Record<string, unknown>) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Nodpeak/0.1" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Swallowed on purpose — see the call site.
  }
}
