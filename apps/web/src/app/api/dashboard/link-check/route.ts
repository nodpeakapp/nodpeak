/**
 * POST /api/dashboard/link-check  { projectId, url }
 *
 * Authenticated, dashboard-triggered. Crawls one page for outbound links and
 * checks each one. Bounded and rate-limited — this is a manual "run it now"
 * button, not a background crawler.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, fail } from "@/lib/http";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { safeFetchHtml, UnsafeUrlError, normalizeUrl } from "@/lib/safe-fetch";
import { extractLinks, checkLinks, isBroken } from "@/lib/link-checker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  projectId: z.string().trim().min(1).max(64),
  url: z.string().trim().min(3).max(2000),
});

export async function POST(req: Request) {
  const user = await requireUser();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("Malformed JSON body", 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  const { projectId, url } = parsed.data;

  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } });
  if (!project) return fail("Project not found", 404);

  const gate = rateLimit(`link-check:${user.id}`, LIMITS.linkCheck);
  if (!gate.allowed) {
    return fail("Too many link checks. Try again in a few minutes.", 429, { retryAfter: gate.retryAfterSeconds });
  }

  let normalized: string;
  try {
    normalized = normalizeUrl(url).toString();
  } catch (err) {
    return fail(err instanceof UnsafeUrlError ? err.message : "Invalid URL", 400);
  }

  let page;
  try {
    page = await safeFetchHtml(normalized);
  } catch (err) {
    if (err instanceof UnsafeUrlError) return fail(err.message, 400);
    return fail("Could not fetch that page", 502);
  }
  if (page.status >= 400) return fail(`That URL returned HTTP ${page.status}`, 422);

  const links = extractLinks(page.html, page.finalUrl);
  const findings = await checkLinks(links);
  const broken = findings.filter((f) => isBroken(f.status));

  const check = await prisma.linkCheck.create({
    data: {
      projectId: project.id,
      url: page.finalUrl,
      totalLinks: findings.length,
      brokenCount: broken.length,
      findingsJson: JSON.stringify(broken.slice(0, 40)),
    },
  });

  return json({
    ok: true,
    id: check.id,
    url: page.finalUrl,
    totalLinks: findings.length,
    brokenCount: broken.length,
    broken,
  });
}
