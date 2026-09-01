/**
 * POST /api/v1/leads
 *
 * Stores a contact / quote-request submission from the embedded contact
 * form. Public and unauthenticated by design, same shape as /feedback:
 * rate-limited per IP per project, no PII beyond what the visitor typed in.
 */

import { z } from "zod";
import { prisma } from "@/lib/db";
import { json, fail, preflight, clientIp, hashIp } from "@/lib/http";
import { rateLimit, LIMITS } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  projectId: z.string().min(1).max(64),
  name: z.string().trim().max(120).nullish(),
  email: z.string().trim().email().max(200).nullish().or(z.literal("").transform(() => null)),
  phone: z.string().trim().max(40).nullish(),
  message: z.string().trim().min(1, "Say a bit about what you need").max(3000),
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
    return fail(parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }
  const input = parsed.data;

  const ip = clientIp(req);
  const ipHash = hashIp(ip);

  const gate = rateLimit(`lead:${ipHash}:${input.projectId}`, LIMITS.lead);
  if (!gate.allowed) {
    return fail("Too many submissions. Try again later.", 429, {
      retryAfter: gate.retryAfterSeconds,
    });
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, siteWidgetConfig: { select: { contactFormEnabled: true } } },
  });
  if (!project) return fail("Project not found", 404);
  if (project.siteWidgetConfig && !project.siteWidgetConfig.contactFormEnabled) {
    return fail("This form is not currently accepting submissions.", 403);
  }

  const lead = await prisma.lead.create({
    data: {
      projectId: project.id,
      name: input.name?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      message: input.message.trim(),
      sourceUrl: input.sourceUrl?.slice(0, 2000) || null,
    },
    select: { id: true },
  });

  return json({ ok: true, leadId: lead.id });
}
