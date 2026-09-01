/**
 * GET /api/dashboard/export-subscribers?project=ID
 *
 * Authenticated CSV export of a project's email-capture subscriber list.
 * Not part of the public /api/v1 surface — this reads real email addresses,
 * so it goes through the same session cookie as the dashboard itself.
 */

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(req: Request) {
  const user = await requireUser();
  const projectId = new URL(req.url).searchParams.get("project") ?? "";

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true, domain: true },
  });
  if (!project) return new NextResponse("Project not found", { status: 404 });

  const subscribers = await prisma.emailSubscriber.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    select: { email: true, createdAt: true, sourceUrl: true },
  });

  const rows = [
    "email,subscribed_at,source_url",
    ...subscribers.map((s) =>
      [csvEscape(s.email), s.createdAt.toISOString(), csvEscape(s.sourceUrl ?? "")].join(","),
    ),
  ];

  return new NextResponse(rows.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${project.domain}-subscribers.csv"`,
    },
  });
}
