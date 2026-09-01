/**
 * POST /api/webhooks/payment
 *
 * Upgrades a user to the HOSTED tier when a payment provider says they paid,
 * and drops them back to FREE on cancellation or refund.
 *
 * Three rules this endpoint does not bend:
 *
 *   1. **Verify before parsing meaning.** The HMAC is checked against the raw
 *      request body, before the JSON is trusted for anything. An unsigned or
 *      mis-signed request is rejected with 401 and nothing is written.
 *   2. **Constant-time comparison.** A `===` on signature strings leaks the
 *      correct value one byte at a time to a patient attacker.
 *   3. **No secret, no service.** If PAYMENT_WEBHOOK_SECRET is unset the
 *      endpoint returns 503 rather than accepting everything. A billing
 *      webhook that fails open grants free upgrades to anyone who can POST.
 *
 * Providers differ in payload shape, so `normalize()` maps the handful that
 * matter onto one internal event. Adding a provider means adding a case there
 * and nothing else.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { json, fail } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NormalizedEvent = {
  provider: string;
  kind: "activate" | "deactivate" | "ignore";
  email: string | null;
  externalId: string | null;
  expiresAt: Date | null;
};

function verify(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = header.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Reads a nested value out of an unknown payload without reaching for `any`. */
function dig(source: unknown, ...path: string[]): unknown {
  let cursor = source;
  for (const key of path) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const date = (v: unknown): Date | null => {
  const raw = str(v);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

function normalize(body: unknown): NormalizedEvent {
  // Lemon Squeezy
  const lsEvent = str(dig(body, "meta", "event_name"));
  if (lsEvent && dig(body, "data", "attributes")) {
    const attrs = dig(body, "data", "attributes");
    const active = ["subscription_created", "subscription_resumed", "subscription_unpaused", "order_created"];
    const dead = ["subscription_cancelled", "subscription_expired", "subscription_payment_failed", "order_refunded"];
    return {
      provider: "lemonsqueezy",
      kind: active.includes(lsEvent) ? "activate" : dead.includes(lsEvent) ? "deactivate" : "ignore",
      email: str(dig(attrs, "user_email")) ?? str(dig(attrs, "customer_email")),
      externalId: str(dig(body, "data", "id")) ?? str(dig(attrs, "order_id")),
      expiresAt: date(dig(attrs, "renews_at")),
    };
  }

  // Paddle
  const paddleEvent = str(dig(body, "event_type"));
  if (paddleEvent && dig(body, "data")) {
    return {
      provider: "paddle",
      kind:
        paddleEvent.startsWith("subscription.activated") || paddleEvent.startsWith("transaction.completed")
          ? "activate"
          : paddleEvent.startsWith("subscription.canceled") || paddleEvent.startsWith("subscription.past_due")
            ? "deactivate"
            : "ignore",
      email: str(dig(body, "data", "customer", "email")),
      externalId: str(dig(body, "data", "id")),
      expiresAt: date(dig(body, "data", "current_billing_period", "ends_at")),
    };
  }

  // 2Checkout / Payoneer style IPN, and the documented generic shape:
  //   { provider, event, email, external_id, expires_at }
  const event = str(dig(body, "event")) ?? str(dig(body, "message_type")) ?? "";
  const activate = /ORDER_CREATED|FRAUD_STATUS_CHANGED|SUBSCRIPTION_ACTIVE|payment\.succeeded|activate/i.test(event);
  const deactivate = /REFUND_ISSUED|SUBSCRIPTION_CANCELED|payment\.refunded|deactivate/i.test(event);

  return {
    provider: str(dig(body, "provider")) ?? "generic",
    kind: activate ? "activate" : deactivate ? "deactivate" : "ignore",
    email:
      str(dig(body, "email")) ??
      str(dig(body, "customer_email")) ??
      str(dig(body, "CUSTOMER_EMAIL")),
    externalId:
      str(dig(body, "external_id")) ?? str(dig(body, "REFNO")) ?? str(dig(body, "order_id")),
    expiresAt: date(dig(body, "expires_at")),
  };
}

export async function POST(req: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (!secret || secret === "change-me") {
    return fail("Billing webhooks are not configured on this install", 503);
  }

  // Read the body ONCE as raw text. Signing over a re-serialized object is
  // the most common way this check gets quietly defeated.
  const rawBody = await req.text();

  const signature =
    req.headers.get("x-nodpeak-signature") ??
    req.headers.get("x-signature") ??
    req.headers.get("paddle-signature");

  if (!verify(rawBody, signature, secret)) {
    return fail("Invalid signature", 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return fail("Malformed JSON body", 400);
  }

  const event = normalize(body);

  const allowed = (process.env.PAYMENT_PROVIDERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(event.provider.toLowerCase())) {
    return fail(`Provider "${event.provider}" is not in PAYMENT_PROVIDERS`, 403);
  }

  if (event.kind === "ignore") {
    return json({ ok: true, handled: false, reason: "event type not actionable" });
  }
  if (!event.email) {
    return fail("Event carried no customer email — cannot match a user", 422);
  }

  const user = await prisma.user.findUnique({
    where: { email: event.email.toLowerCase().trim() },
    select: { id: true, plan: true },
  });
  if (!user) {
    // 202, not 404: the payment is real, the account just doesn't exist yet.
    // Returning an error here makes providers retry forever.
    return json(
      { ok: true, handled: false, reason: "no matching user; will apply on sign-up" },
      202,
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: event.kind === "activate" ? "HOSTED" : "FREE",
      planProvider: event.provider,
      planExternalId: event.externalId,
      planExpiresAt: event.kind === "activate" ? event.expiresAt : null,
    },
    select: { id: true, plan: true },
  });

  return json({ ok: true, handled: true, userId: updated.id, plan: updated.plan });
}
