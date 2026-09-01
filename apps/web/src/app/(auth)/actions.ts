"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, setSessionCookie, clearSessionCookie } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/ratelimit";
import { headers } from "next/headers";
import { hashIp } from "@/lib/http";

export type AuthState = { error: string | null };

const Credentials = z.object({
  email: z.string().trim().toLowerCase().email("That doesn't look like an email address"),
  password: z.string().min(10, "Use at least 10 characters"),
  name: z.string().trim().max(120).optional(),
});

async function ipKey(prefix: string): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "0.0.0.0";
  return `${prefix}:${hashIp(fwd.split(",")[0]!.trim())}`;
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if ((process.env.ALLOW_REGISTRATION ?? "true").toLowerCase() === "false") {
    return { error: "Registration is closed on this install." };
  }
  if (!rateLimit(await ipKey("register"), LIMITS.auth).allowed) {
    return { error: "Too many attempts. Try again in an hour." };
  }

  const parsed = Credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { error: "An account with that email already exists." };

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password),
      plan: "FREE",
    },
    select: { id: true },
  });

  await setSessionCookie(user.id);
  redirect("/dashboard");
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!rateLimit(await ipKey("login"), LIMITS.auth).allowed) {
    return { error: "Too many attempts. Try again in an hour." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Same message and comparable timing whether the email exists or not —
  // otherwise the login form doubles as a customer-list oracle.
  const ok = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "$2a$11$" + "x".repeat(53));

  if (!user || !ok) return { error: "Email or password is incorrect." };

  await setSessionCookie(user.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
