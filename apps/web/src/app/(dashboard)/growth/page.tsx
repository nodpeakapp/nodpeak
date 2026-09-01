import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Empty } from "@/components/empty";
import { SiteConfigForm } from "@/components/site-config-form";
import { updateSiteConfigAction } from "../actions";

export const metadata: Metadata = { title: "Growth" };
export const dynamic = "force-dynamic";

function safeItems(raw: string | undefined | null): Array<{ icon: string; label: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function GrowthPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: selected } = await searchParams;

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { siteWidgetConfig: true },
  });

  if (projects.length === 0) {
    return (
      <Empty
        title="No projects yet"
        body="Create a project first — every growth feature is scoped to one website."
        action={<Link href="/dashboard" className="btn-primary">Go to overview</Link>}
      />
    );
  }

  const active = projects.find((p) => p.id === selected) ?? projects[0]!;
  const sc = active.siteWidgetConfig;

  const config = {
    announcementEnabled: sc?.announcementEnabled ?? false,
    announcementText: sc?.announcementText ?? "",
    announcementLinkUrl: sc?.announcementLinkUrl ?? null,
    announcementLinkText: sc?.announcementLinkText ?? null,
    announcementBg: sc?.announcementBg ?? "#25D6E8",
    announcementFg: sc?.announcementFg ?? "#0A0B0D",
    whatsappEnabled: sc?.whatsappEnabled ?? false,
    whatsappNumber: sc?.whatsappNumber ?? null,
    whatsappMessage: sc?.whatsappMessage ?? "Hi! I have a question.",
    emailCaptureEnabled: sc?.emailCaptureEnabled ?? false,
    emailCaptureTitle: sc?.emailCaptureTitle ?? "Get 10% off your first order",
    emailCaptureSubtitle: sc?.emailCaptureSubtitle ?? "Join the list — no spam, unsubscribe anytime.",
    emailCaptureDelayMs: sc?.emailCaptureDelayMs ?? 4000,
    trustBarEnabled: sc?.trustBarEnabled ?? false,
    trustBarItems: safeItems(sc?.trustBarItemsJson),
    contactFormEnabled: sc?.contactFormEnabled ?? false,
    contactFormTitle: sc?.contactFormTitle ?? "Get a quote",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Get customers &amp; get trusted</h1>
        <p className="mt-1 text-sm text-zinc-400">
          These render from the same one-line script tag already on your site — no second embed needed.
        </p>
      </div>

      {projects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/growth?project=${p.id}`}
              className={`chip transition ${
                p.id === active.id ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-200" : "hover:border-zinc-600"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      <SiteConfigForm projectId={active.id} config={config} action={updateSiteConfigAction} />
    </div>
  );
}
