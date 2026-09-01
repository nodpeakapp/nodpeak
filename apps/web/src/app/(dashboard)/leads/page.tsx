import type { Metadata } from "next";
import Link from "next/link";
import { Trash2, Mail, Phone, Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Empty } from "@/components/empty";
import { updateLeadStatusAction, deleteLeadAction } from "../actions";

export const metadata: Metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

const TABS = [
  { id: "leads", label: "Contact & quote leads" },
  { id: "subscribers", label: "Email subscribers" },
] as const;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; tab?: string }>;
}) {
  const user = await requireUser();
  const { project: selected, tab: tabParam } = await searchParams;

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (projects.length === 0) {
    return (
      <Empty
        title="No projects yet"
        body="Leads and subscribers land here once a project has the contact form or email popup turned on."
        action={<Link href="/dashboard" className="btn-primary">Go to overview</Link>}
      />
    );
  }

  const active = projects.find((p) => p.id === selected) ?? projects[0]!;
  const tab = tabParam === "subscribers" ? "subscribers" : "leads";

  const [leads, subscriberCount, subscribers] = await Promise.all([
    tab === "leads"
      ? prisma.lead.findMany({ where: { projectId: active.id }, orderBy: { createdAt: "desc" }, take: 200 })
      : Promise.resolve([]),
    prisma.emailSubscriber.count({ where: { projectId: active.id } }),
    tab === "subscribers"
      ? prisma.emailSubscriber.findMany({ where: { projectId: active.id }, orderBy: { createdAt: "desc" }, take: 500 })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      {projects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/leads?project=${p.id}&tab=${tab}`}
              className={`chip transition ${
                p.id === active.id ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-200" : "hover:border-zinc-600"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-800">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/leads?project=${active.id}&tab=${t.id}`}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
                tab === t.id ? "border-cyan-500 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
              {t.id === "subscribers" && subscriberCount > 0 && (
                <span className="ml-1.5 text-xs text-zinc-500">({subscriberCount})</span>
              )}
            </Link>
          ))}
        </div>
        {tab === "subscribers" && subscriberCount > 0 && (
          <a
            href={`/api/dashboard/export-subscribers?project=${active.id}`}
            className="btn-ghost !px-3 !py-1.5 !text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        )}
      </div>

      {tab === "leads" ? (
        leads.length === 0 ? (
          <Empty title="No leads yet" body="Turn on the contact/quote form under Growth, embed the form, and submissions land here." />
        ) : (
          <ul className="space-y-3">
            {leads.map((l) => (
              <li key={l.id} className="panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`chip !py-0.5 !text-[10px] ${
                        l.status === "NEW"
                          ? "border-cyan-500/50 text-cyan-300"
                          : l.status === "ARCHIVED"
                            ? "opacity-60"
                            : ""
                      }`}
                    >
                      {l.status.toLowerCase()}
                    </span>
                    <span className="text-sm font-semibold">{l.name || "No name given"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.status !== "READ" && (
                      <form action={updateLeadStatusAction}>
                        <input type="hidden" name="leadId" value={l.id} />
                        <input type="hidden" name="status" value="READ" />
                        <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs">Mark read</button>
                      </form>
                    )}
                    {l.status !== "ARCHIVED" && (
                      <form action={updateLeadStatusAction}>
                        <input type="hidden" name="leadId" value={l.id} />
                        <input type="hidden" name="status" value="ARCHIVED" />
                        <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs">Archive</button>
                      </form>
                    )}
                    <form action={deleteLeadAction}>
                      <input type="hidden" name="leadId" value={l.id} />
                      <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs hover:!border-red-800 hover:!text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{l.message}</p>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                  {l.email && (
                    <a href={`mailto:${l.email}`} className="flex items-center gap-1 hover:text-cyan-400">
                      <Mail className="h-3 w-3" />
                      {l.email}
                    </a>
                  )}
                  {l.phone && (
                    <a href={`tel:${l.phone}`} className="flex items-center gap-1 hover:text-cyan-400">
                      <Phone className="h-3 w-3" />
                      {l.phone}
                    </a>
                  )}
                  <span>{l.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : subscribers.length === 0 ? (
        <Empty title="No subscribers yet" body="Turn on the email capture popup under Growth and signups land here." />
      ) : (
        <div className="panel overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id} className="border-b border-surface-850 last:border-0">
                  <td className="px-5 py-3 font-mono text-zinc-200">{s.email}</td>
                  <td className="px-5 py-3 text-zinc-500">{s.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
