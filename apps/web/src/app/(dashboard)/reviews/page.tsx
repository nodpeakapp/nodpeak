import type { Metadata } from "next";
import Link from "next/link";
import { Eye, EyeOff, Trash2, ExternalLink, Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Stars } from "@/components/stars";
import { Empty } from "@/components/empty";
import { toggleReviewPublicAction, deleteReviewAction, toggleReviewFeaturedAction } from "../actions";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Awaiting approval" },
  { id: "public", label: "Public" },
  { id: "negative", label: "Needs a reply" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; filter?: string }>;
}) {
  const user = await requireUser();
  const { project: selected, filter: filterParam } = await searchParams;

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (projects.length === 0) {
    return (
      <Empty
        title="No projects yet"
        body="Reviews land here once a project has the widget installed."
        action={<Link href="/dashboard" className="btn-primary">Go to overview</Link>}
      />
    );
  }

  const active = projects.find((p) => p.id === selected) ?? projects[0]!;
  const filter = (FILTERS.find((f) => f.id === filterParam)?.id ?? "all") as Filter;

  const where = {
    projectId: active.id,
    ...(filter === "pending" ? { isPublic: false } : {}),
    ...(filter === "public" ? { isPublic: true } : {}),
    ...(filter === "negative" ? { sentiment: "NEGATIVE" } : {}),
  };

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const qs = (f: Filter) =>
    `/reviews?project=${active.id}${f === "all" ? "" : `&filter=${f}`}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {projects.length > 1 &&
          projects.map((p) => (
            <Link
              key={p.id}
              href={`/reviews?project=${p.id}`}
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

      <div className="flex gap-1 overflow-x-auto border-b border-surface-800">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={qs(f.id)}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
              filter === f.id
                ? "border-cyan-500 text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <Empty
          title="Nothing here"
          body={
            filter === "all"
              ? "No reviews collected yet for this project."
              : "No reviews match this filter."
          }
        />
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id} className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Stars rating={r.rating} size={16} />
                  <span
                    className={`chip !py-0.5 !text-[10px] ${
                      r.sentiment === "NEGATIVE"
                        ? "border-red-900/60 text-red-300"
                        : r.sentiment === "POSITIVE"
                          ? "border-emerald-900/60 text-emerald-300"
                          : ""
                    }`}
                  >
                    {r.sentiment.toLowerCase()}
                  </span>
                  {r.isPublic ? (
                    <span className="chip !py-0.5 !text-[10px] border-cyan-500/50 text-cyan-300">
                      public
                    </span>
                  ) : (
                    <span className="chip !py-0.5 !text-[10px]">pending</span>
                  )}
                  {r.redirectedExternal && (
                    <span className="chip !py-0.5 !text-[10px]">
                      <ExternalLink className="h-3 w-3" />
                      sent onward
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <form action={toggleReviewPublicAction}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <button
                      type="submit"
                      className="btn-ghost !px-3 !py-1.5 !text-xs"
                      title={r.isPublic ? "Hide from the public wall and schema" : "Approve for the public wall and schema"}
                    >
                      {r.isPublic ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {r.isPublic ? "Unpublish" : "Approve"}
                    </button>
                  </form>
                  {r.isPublic && r.comment && (
                    <form action={toggleReviewFeaturedAction}>
                      <input type="hidden" name="reviewId" value={r.id} />
                      <button
                        type="submit"
                        className={`btn-ghost !px-3 !py-1.5 !text-xs ${r.featuredForWall ? "!border-cyan-500/60 !text-cyan-300" : ""}`}
                        title={r.featuredForWall ? "Remove from testimonials wall" : "Feature on testimonials wall"}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {r.featuredForWall ? "Featured" : "Feature"}
                      </button>
                    </form>
                  )}
                  <form action={deleteReviewAction}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <button
                      type="submit"
                      className="btn-ghost !px-3 !py-1.5 !text-xs hover:!border-red-800 hover:!text-red-300"
                      title="Delete permanently"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </div>

              {r.comment && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                  {r.comment}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span>{r.customerName || "Anonymous"}</span>
                {r.customerEmail && (
                  <a href={`mailto:${r.customerEmail}`} className="hover:text-cyan-400">
                    {r.customerEmail}
                  </a>
                )}
                <span>{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
                {r.sourceUrl && (
                  <a
                    href={r.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:text-cyan-400"
                  >
                    {r.sourceUrl.replace(/^https?:\/\//, "").slice(0, 50)}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
