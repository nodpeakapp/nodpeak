import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

export function json(data: unknown, init: number | ResponseInit = 200) {
  const responseInit: ResponseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, {
    ...responseInit,
    headers: { ...CORS_HEADERS, ...(responseInit.headers ?? {}) },
  });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return json({ ok: false, error: message, ...extra }, status);
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Best-effort client IP behind nginx. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

/**
 * Reviews are stored with a hashed IP, never a raw one — enough to
 * rate-limit and spot duplicates, not enough to be a GDPR liability.
 */
export function hashIp(ip: string): string {
  return createHash("sha256")
    .update(`${ip}:${process.env.AUTH_SECRET ?? "nodpeak"}`)
    .digest("hex")
    .slice(0, 32);
}
