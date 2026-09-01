import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { aggregate } from "@/lib/schema-generator";
import { Stars } from "@/components/stars";
import { Empty } from "@/components/empty";
import { AuditPanel } from "@/components/audit-panel";
import { LinkCheckPanel } from "@/components/link-check-panel";
import { UptimePanel } from "@/components/uptime-panel";
import { SnippetPreview } from "@/components/snippet-preview";
import { NewProjectForm } from "../project-form";
import { createProjectAction, updateUptimeMonitorAction } from "../actions";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: selected } = await searchParams;

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { reviews: true } } },
  });

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <Empty
          title="No projects yet"
          body="A project is one website. Add it, drop the one-line script into the page, and reviews start landing here."
        />
        <NewProjectForm action={createProjectAction} />
      </div>
    );
  }

  const active =
    projects.find((p) => p.id === selected) ?? projects[0]!;

  const uptimeMonitor = await prisma.uptimeMonitor.findUnique({ where: { projectId: active.id } });

  const [publicReviews, recent] = await Promise.all([
    prisma.review.findMany({
      where: { projectId: active.id, isPublic: true },
      select: { rating: true },
    }),
    prisma.review.findMany({
      where: { projectId: active.id },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const pending = await prisma.review.count({
    where: { projectId: active.id, isPublic: false },
  });

  const stats = aggregate(publicReviews);

  return (
    <div className="space-y-6">
      {projects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard?project=${p.id}`}
              className={`chip transition ${
                p.id === active.id
                  ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-200"
                  : "hover:border-zinc-600"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Public rating" value={stats.count ? stats.average.toFixed(1) : "—"} accent />
        <Stat label="Public reviews" value={String(stats.count)} />
        <Stat label="Awaiting approval" value={String(pending)} />
        <Stat label="Total collected" value={String(active._count.reviews)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SnippetPreview
          domain={active.domain}
          title={`${active.name} — ${active.domain}`}
          description="Your meta description shows here. The stars above it come from approved reviews only."
          stats={stats}
          eligible={stats.count > 0}
        />

        <div className="panel p-6">
          <h2 className="text-base font-semibold">Latest reviews</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Nothing yet. Copy the embed snippet from{" "}
              <Link href="/widgets" className="font-semibold text-cyan-500 hover:text-cyan-400">
                Widgets
              </Link>{" "}
              and paste it before <code>&lt;/body&gt;</code> on {active.domain}.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-surface-800 border-t border-surface-800">
              {recent.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Stars rating={r.rating} />
                    <span className="text-xs text-zinc-500">
                      {r.isPublic ? "public" : "pending"}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-zinc-400">
                      {r.comment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {recent.length > 0 && (
            <Link href="/reviews" className="btn-ghost mt-5 w-full">
              Open the inbox
            </Link>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Get found</h2>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <AuditPanel projectId={active.id} domain={active.domain} />
          <LinkCheckPanel projectId={active.id} domain={active.domain} />
        </div>
        <div className="mt-6">
          <UptimePanel
            projectId={active.id}
            status={{
              enabled: uptimeMonitor?.enabled ?? false,
              url: uptimeMonitor?.url ?? null,
              notifyEmail: uptimeMonitor?.notifyEmail ?? null,
              intervalMinutes: uptimeMonitor?.intervalMinutes ?? 5,
              lastStatus: (uptimeMonitor?.lastStatus as "UP" | "DOWN" | null) ?? null,
              lastCheckedAt: uptimeMonitor?.lastCheckedAt?.toISOString() ?? null,
              consecutiveFails: uptimeMonitor?.consecutiveFails ?? 0,
            }}
            action={updateUptimeMonitorAction}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel px-5 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${accent ? "text-cyan-500" : ""}`}>
        {value}
      </div>
    </div>
  );
}
