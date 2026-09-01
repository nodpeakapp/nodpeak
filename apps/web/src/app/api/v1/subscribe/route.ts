/**
 * POST /api/v1/subscribe
 *
 * Stores an email-capture-popup signup. Idempotent per project+email — a
 * repeat submission from the same visitor is a 200, not a duplicate row.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, fail, preflight, clientIp, hashIp } from "@/lib/http";
import { rateLimit, LIMITS } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  projectId: z.string().min(1).max(64),
  email: z.string().trim().email().max(200),
  sourceUrl: z.string().trim().max(2000).nullish(),
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
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Enter a valid email", 422);
  }
  const input = parsed.data;

  const ip = clientIp(req);
  const ipHash = hashIp(ip);

  const gate = rateLimit(`subscribe:${ipHash}:${input.projectId}`, LIMITS.subscribe);
  if (!gate.allowed) {
    return fail("Too many submissions. Try again later.", 429, {
      retryAfter: gate.retryAfterSeconds,
    });
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true },
  });
  if (!project) return fail("Project not found", 404);

  await prisma.emailSubscriber.upsert({
    where: { projectId_email: { projectId: project.id, email: input.email.toLowerCase() } },
    create: {
      projectId: project.id,
      email: input.email.toLowerCase(),
      sourceUrl: input.sourceUrl?.slice(0, 2000) || null,
    },
    update: {},
  });

  return json({ ok: true });
}
