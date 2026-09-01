/**
 * POST /api/v1/seo-audit  { url, projectId? }
 *
 * Fetches a page server-side and reports what is missing. See safe-fetch.ts
 * for why every redirect hop is re-validated — this endpoint takes a URL from
 * an untrusted caller and fetches it from inside the container, which is the
 * classic SSRF shape.
 *
 * Results are persisted only when a projectId is supplied AND the caller owns
 * that project. Anonymous audits run and return, but write nothing.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, fail, preflight, clientIp, hashIp } from "@/lib/http";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { safeFetchHtml, UnsafeUrlError } from "@/lib/safe-fetch";
import {
  extractMeta,
  extractJsonLd,
  estimateMobileSpeed,
  pagespeedScore,
  buildFindings,
  scoreFrom,
  countMissingMeta,
} from "@/lib/seo-audit";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  url: z.string().trim().min(3).max(2000),
  projectId: z.string().trim().max(64).nullish(),
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
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  const { url, projectId } = parsed.data;

  const ipHash = hashIp(clientIp(req));
  const gate = rateLimit(`audit:${ipHash}`, LIMITS.audit);
  if (!gate.allowed) {
    return fail("Too many audits. Try again later.", 429, { retryAfter: gate.retryAfterSeconds });
  }

  let page;
  try {
    page = await safeFetchHtml(url);
  } catch (err) {
    if (err instanceof UnsafeUrlError) return fail(err.message, 400);
    return fail("Could not fetch that page", 502);
  }

  if (page.status >= 400) {
    return fail(`That URL returned HTTP ${page.status}`, 422, { finalUrl: page.finalUrl });
  }

  const meta = extractMeta(page.html);
  const jsonLd = extractJsonLd(page.html);

  const measured = await pagespeedScore(page.finalUrl);
  const mobileSpeed = measured ?? estimateMobileSpeed(page.html, page.bytes);
  const mobileSpeedSource: "pagespeed" | "estimated" = measured === null ? "estimated" : "pagespeed";

  const findings = buildFindings(meta, jsonLd, page.bytes);

  if (page.truncated) {
    findings.push({
      id: "audit.truncated",
      label: "Audit coverage",
      severity: "info",
      detail: `Page exceeded the ${(Number(process.env.SEO_AUDIT_MAX_BYTES ?? 2_000_000) / 1_000_000).toFixed(1)} MB read limit — findings cover the first part of the HTML only.`,
    });
  }
  if (page.html.length > 0 && meta.h1.length === 0 && meta.title === null) {
    findings.push({
      id: "audit.clientrendered",
      label: "Audit coverage",
      severity: "info",
      detail: "The server returned almost no content. This is likely a client-rendered app, so these findings describe what a crawler sees before JavaScript runs — which is often the real problem.",
    });
  }

  const score = scoreFrom(findings, mobileSpeed);
  const missingMetaCount = countMissingMeta(meta);

  // Persist only for an owned project.
  let saved: string | null = null;
  if (projectId) {
    const user = await getCurrentUser();
    if (user) {
      const owned = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
        select: { id: true },
      });
      if (owned) {
        const row = await prisma.seoAudit.create({
          data: {
            projectId: owned.id,
            url: page.finalUrl,
            score,
            mobileSpeed,
            missingMetaCount,
            schemaValid: jsonLd.valid,
            findingsJson: JSON.stringify(findings),
            lastCheckedAt: new Date(),
          },
          select: { id: true },
        });
        saved = row.id;
      }
    }
  }

  return json({
    ok: true,
    savedAuditId: saved,
    url: page.finalUrl,
    requestedUrl: url,
    redirects: page.redirects,
    fetchMs: page.elapsedMs,
    pageBytes: page.bytes,
    score,
    mobileSpeed,
    mobileSpeedSource,
    missingMetaCount,
    schemaValid: jsonLd.valid,
    meta,
    jsonLd,
    findings,
  });
}
