import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { isSelfHost, limitsFor } from "@/lib/enums";
import { Empty } from "@/components/empty";
import { SettingsForm } from "@/components/settings-form";
import { NewProjectForm } from "../project-form";
import { createProjectAction, updateProjectAction, deleteProjectAction } from "../actions";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: selected } = await searchParams;

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  const limits = limitsFor(user.plan);
  const canAdd = projects.length < limits.projects;

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <Empty title="No projects yet" body="Add one to get started." />
        <NewProjectForm action={createProjectAction} />
      </div>
    );
  }

  const active = projects.find((p) => p.id === selected) ?? projects[0]!;

  return (
    <div className="space-y-6">
      {projects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/settings?project=${p.id}`}
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

      <SettingsForm project={active} action={updateProjectAction} />

      <div className="panel p-6">
        <h2 className="text-base font-semibold">Account</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Email</dt>
            <dd className="mt-1 text-zinc-200">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Plan</dt>
            <dd className="mt-1 text-zinc-200">
              {isSelfHost() ? "Self-hosted (no limits)" : user.plan}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Projects</dt>
            <dd className="mt-1 text-zinc-200">
              {projects.length}
              {Number.isFinite(limits.projects) ? ` / ${limits.projects}` : ""}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-zinc-500">
          This install serves the widget from <code className="text-cyan-400">{appUrl()}</code>.
          If that is wrong, fix <code className="text-cyan-400">APP_URL</code> in{" "}
          <code className="text-cyan-400">.env</code> and restart — every embed snippet is
          built from it.
        </p>
      </div>

      {canAdd && <NewProjectForm action={createProjectAction} />}

      <form action={deleteProjectAction} className="panel border-red-900/40 p-6">
        <input type="hidden" name="projectId" value={active.id} />
        <h2 className="text-base font-semibold text-red-300">Delete this project</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">
          Removes {active.name} and every review collected for it. There is no undo and no
          export — take a database backup first if any of it matters.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            name="confirm"
            className="input"
            placeholder={`Type ${active.domain} to confirm`}
            autoComplete="off"
          />
          <button
            type="submit"
            className="btn shrink-0 border border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-950/70"
          >
            Delete project
          </button>
        </div>
      </form>
    </div>
  );
}
