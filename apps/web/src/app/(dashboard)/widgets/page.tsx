import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { Empty } from "@/components/empty";
import { EmbedGenerator } from "@/components/embed-generator";
import { WidgetForm } from "@/components/widget-form";
import { updateWidgetAction } from "../actions";

export const metadata: Metadata = { title: "Widgets" };
export const dynamic = "force-dynamic";

export default async function WidgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: selected } = await searchParams;

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { widgetConfig: true },
  });

  if (projects.length === 0) {
    return (
      <Empty
        title="No projects yet"
        body="Create a project first — the embed snippet is generated from its id."
        action={<Link href="/dashboard" className="btn-primary">Go to overview</Link>}
      />
    );
  }

  const active = projects.find((p) => p.id === selected) ?? projects[0]!;

  const config = {
    primaryColor: active.widgetConfig?.primaryColor ?? "#0A0B0D",
    accentColor: active.widgetConfig?.accentColor ?? "#25D6E8",
    title: active.widgetConfig?.title ?? "How did we do?",
    subtitle: active.widgetConfig?.subtitle ?? "Your feedback takes 10 seconds.",
    promptQuestion: active.widgetConfig?.promptQuestion ?? "Tell us a little more",
    minStarForExternal: active.widgetConfig?.minStarForExternal ?? 1,
    showSeoBadge: active.widgetConfig?.showSeoBadge ?? true,
    placement: active.widgetConfig?.placement ?? "bubble",
  };

  return (
    <div className="space-y-6">
      {projects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/widgets?project=${p.id}`}
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

      <EmbedGenerator appUrl={appUrl()} projectId={active.id} />

      <WidgetForm
        projectId={active.id}
        config={config}
        action={updateWidgetAction}
        hasGoogle={Boolean(active.googlePlaceId)}
        hasTrustpilot={Boolean(active.trustpilotSlug)}
        canHideBadge={user.plan === "HOSTED"}
      />
    </div>
  );
}
