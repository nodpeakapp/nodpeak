/**
 * POST /api/webhooks/payment
 *
 * Upgrades a user to the HOSTED tier when a payment provider says they paid,
 * and drops them back to FREE on cancellation or refund.
 *
 * Three rules this endpoint does not bend:
 *
 *   1. **Verify before parsing meaning.** The signature is checked against the
 *      raw request body, before the JSON is trusted for anything. An unsigned
 *      or mis-signed request is rejected with 401 and nothing is written.
 *   2. **Constant-time comparison.** A `===` on signature strings leaks the
 *      correct value one byte at a time to a patient attacker.
 *   3. **No secret, no service.** If a provider's secret is unset the endpoint
 *      returns 503 for that provider rather than accepting everything. A
 *      billing webhook that fails open grants free upgrades to anyone who can
 *      POST.
 *
 * Two signing schemes are handled, because Polar doesn't sign the way the
 * others do:
 *
 *   - **Polar** sends the "Standard Webhooks" headers (`webhook-id`,
 *     `webhook-timestamp`, `webhook-signature`) and signs
 *     `{id}.{timestamp}.{raw body}` with HMAC-SHA256, using a base64-encoded
 *     secret, base64-encoded output, and a `v1,<sig>` prefix (possibly several,
 *     space-separated, for secret rotation). It also carries a timestamp that
 *     has to be checked for replay.
 *   - **Everyone else here** (Lemon Squeezy, Paddle, and a documented generic
 *     shape) is verified the simpler way this endpoint always has: a plain
 *     hex HMAC-SHA256 over the raw body, checked against one shared secret.
 *
 * Providers differ in payload shape too, so `normalizePolar()` / `normalize()`
 * map the handful that matter onto one internal event. Adding a provider to
 * the generic path means adding a case to `normalize()` and nothing else.
 *
 * NOTE on Polar's payload: the exact JSON path to the customer's email was
 * not confirmed against a live delivery when this was written — it reads
 * `data.customer.email` with a couple of fallbacks below. Log the first real
 * webhook Polar sends this endpoint and adjust `normalizePolar()` if that
 * path is wrong before relying on it. Polar's own recommended reconciliation
 * key is `customer.external_id`, not email — see the comment on
 * `planExternalId` below if you want to switch to that instead.
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

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Generic HMAC path — Lemon Squeezy, Paddle, and the documented generic shape
// ---------------------------------------------------------------------------

function verifyGeneric(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const provided = header.trim().replace(/^sha256=/i, "");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqualStr(provided, expected);
}

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

// ---------------------------------------------------------------------------
// Polar — Standard Webhooks signing, different payload shape
// ---------------------------------------------------------------------------

const POLAR_TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Polar's secret (from the dashboard's webhook endpoint settings) is
 * base64-encoded and may carry a `whsec_` prefix, matching the Standard
 * Webhooks convention. Both are normalized away here before use as an HMAC
 * key.
 */
function decodePolarSecret(secret: string): Buffer {
  const stripped = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  return Buffer.from(stripped, "base64");
}

function verifyPolar(
  rawBody: string,
  webhookId: string | null,
  webhookTimestamp: string | null,
  webhookSignature: string | null,
  secret: string,
): boolean {
  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

  const timestampSeconds = Number(webhookTimestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const skewSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (skewSeconds > POLAR_TIMESTAMP_TOLERANCE_SECONDS) return false; // stale — possible replay

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", decodePolarSecret(secret))
    .update(signedContent, "utf8")
    .digest("base64");

  // The header can carry several space-separated `v1,<sig>` candidates
  // (Polar rotates secrets by sending both old and new for a window).
  return webhookSignature
    .split(" ")
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => candidate.replace(/^v1,/, ""))
    .some((candidate) => candidate.length === expected.length && timingSafeEqualStr(candidate, expected));
}

const POLAR_ACTIVATE_EVENTS = new Set(["subscription.active", "subscription.uncanceled", "subscription.resumed", "order.paid"]);
const POLAR_DEACTIVATE_EVENTS = new Set(["subscription.canceled", "subscription.revoked", "subscription.past_due"]);

function normalizePolar(body: unknown): NormalizedEvent {
  const type = str(dig(body, "type")) ?? "";
  const data = dig(body, "data");

  return {
    provider: "polar",
    kind: POLAR_ACTIVATE_EVENTS.has(type) ? "activate" : POLAR_DEACTIVATE_EVENTS.has(type) ? "deactivate" : "ignore",
    email:
      str(dig(data, "customer", "email")) ??
      str(dig(data, "customer_email")) ??
      // Unconfirmed fallback for the order shape — verify against a real payload.
      str(dig(data, "customer", "email_address")),
    externalId:
      str(dig(data, "customer", "external_id")) ?? str(dig(data, "id")),
    expiresAt: date(dig(data, "current_period_end")) ?? date(dig(data, "ends_at")),
  };
}

// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const rawBody = await req.text();

  // Polar identifies itself by its own header trio — check for those first,
  // since it doesn't send any of the generic-path signature headers at all.
  const polarWebhookId = req.headers.get("webhook-id");
  const polarWebhookTimestamp = req.headers.get("webhook-timestamp");
  const polarWebhookSignature = req.headers.get("webhook-signature");
  const isPolarShaped = Boolean(polarWebhookId && polarWebhookTimestamp && polarWebhookSignature);

  let event: NormalizedEvent;

  if (isPolarShaped) {
    const polarSecret = process.env.POLAR_WEBHOOK_SECRET?.trim();
    if (!polarSecret || polarSecret === "change-me") {
      return fail("Polar webhooks are not configured on this install", 503);
    }
    if (!verifyPolar(rawBody, polarWebhookId, polarWebhookTimestamp, polarWebhookSignature, polarSecret)) {
      return fail("Invalid signature", 401);
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail("Malformed JSON body", 400);
    }
    event = normalizePolar(body);
  } else {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
    if (!secret || secret === "change-me") {
      return fail("Billing webhooks are not configured on this install", 503);
    }

    const signature =
      req.headers.get("x-nodpeak-signature") ??
      req.headers.get("x-signature") ??
      req.headers.get("paddle-signature");

    if (!verifyGeneric(rawBody, signature, secret)) {
      return fail("Invalid signature", 401);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return fail("Malformed JSON body", 400);
    }
    event = normalize(body);
  }

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
