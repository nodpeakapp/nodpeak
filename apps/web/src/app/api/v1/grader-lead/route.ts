/**
 * POST /api/v1/grader-lead  { email, url, score }
 *
 * Captures an email from the public /grader tool ("email me the full
 * report"). Nodpeak's own marketing lead, not a customer's — see the
 * comment on GraderLead in schema.prisma. 404s entirely unless this
 * deployment has opted in with ENABLE_GRADER=true, same gate as the
 * /grader page itself. (The audit it's attached to runs through the
 * existing /api/v1/seo-audit endpoint, which stays ungated — logged-in
 * customers use that same endpoint for their own projects.)
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, fail, preflight, clientIp, hashIp } from "@/lib/http";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { graderEnabled } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().email().max(200),
  url: z.string().trim().min(3).max(2000),
  score: z.number().int().min(0).max(100),
  sourceUrl: z.string().trim().max(2000).nullish(),
});

export async function OPTIONS() {
  return preflight();
}

export async function POST(req: Request) {
  if (!graderEnabled()) return fail("Not found", 404);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("Malformed JSON body", 400);
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  const { email, url, score, sourceUrl } = parsed.data;

  const ip = clientIp(req);
  const ipHash = hashIp(ip);

  const gate = rateLimit(`grader-lead:${ipHash}`, LIMITS.graderLead);
  if (!gate.allowed) {
    return fail("Too many submissions. Try again later.", 429, { retryAfter: gate.retryAfterSeconds });
  }

  await prisma.graderLead.create({
    data: {
      email: email.toLowerCase(),
      auditedUrl: url,
      score,
      sourceUrl: sourceUrl?.slice(0, 2000) || null,
      ipHash,
    },
  });

  return json({ ok: true });
}
