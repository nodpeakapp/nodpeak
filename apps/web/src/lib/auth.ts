import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { requireSecret } from "./env";

const COOKIE = "nodpeak_session";
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 30);

/* ── password hashing ─────────────────────────────────────── */
// bcryptjs is pure JS: no node-gyp, no prebuilt binary roulette on ARM64.
const ROUNDS = 11;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/* ── stateless signed session cookie ──────────────────────── */
/**
 * Payload is `userId.expiresAtMs.nonce`, signed with HMAC-SHA256.
 * No session table: a SQLite install shouldn't take a write on every
 * page view. Sign-out clears the cookie; rotating AUTH_SECRET
 * invalidates every session at once.
 */

type SessionPayload = { userId: string; expiresAt: number };

function sign(value: string): string {
  return createHmac("sha256", requireSecret("AUTH_SECRET"))
    .update(value)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function createSessionToken(userId: string): { token: string; expiresAt: Date } {
  const expiresAt = Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000;
  const body = `${userId}.${expiresAt}.${randomBytes(9).toString("base64url")}`;
  return { token: `${body}.${sign(body)}`, expiresAt: new Date(expiresAt) };
}

export function readSessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, expiresRaw, nonce, mac] = parts;
  const body = `${userId}.${expiresRaw}.${nonce}`;
  if (!safeEqual(mac, sign(body))) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  return { userId, expiresAt };
}

/* ── cookie helpers (Server Actions / Route Handlers only) ─── */

export async function setSessionCookie(userId: string) {
  const { token, expiresAt } = createSessionToken(userId);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE, "", { path: "/", maxAge: 0 });
}

/* ── lookups ──────────────────────────────────────────────── */

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const payload = readSessionToken(store.get(COOKIE)?.value);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, plan: true },
  });
  return user ?? null;
}

/** Use in every dashboard page and mutating route. Throws if signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return user as SessionUser;
}

/**
 * Confirms a project belongs to the signed-in user before any read or write.
 * Every dashboard query goes through this — project ids are public (they
 * live in the embed snippet), so ownership can never be inferred from
 * possession of the id.
 */
export async function requireProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { widgetConfig: true },
  });
  if (!project) throw new Error("Project not found");
  return project;
}

export const SESSION_COOKIE_NAME = COOKIE;
