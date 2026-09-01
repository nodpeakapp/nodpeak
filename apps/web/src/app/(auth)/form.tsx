"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { AuthState } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary mt-6 w-full" disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}

export function AuthForm({
  mode,
  action,
  registrationOpen = true,
}: {
  mode: "login" | "register";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  registrationOpen?: boolean;
}) {
  const [state, formAction] = useActionState(action, { error: null } as AuthState);
  const isRegister = mode === "register";

  if (isRegister && !registrationOpen) {
    return (
      <div className="panel p-6">
        <h1 className="text-xl font-bold tracking-tight">Registration is closed</h1>
        <p className="mt-2 text-sm text-zinc-400">
          This install has <code className="text-cyan-400">ALLOW_REGISTRATION=false</code>. Ask
          the administrator for an account.
        </p>
        <Link href="/login" className="btn-ghost mt-5 w-full">
          Sign in instead
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="panel p-6">
      <h1 className="text-xl font-bold tracking-tight">
        {isRegister ? "Create your account" : "Sign in"}
      </h1>
      <p className="mt-1.5 text-sm text-zinc-400">
        {isRegister
          ? "One project, one widget, sixty seconds."
          : "Welcome back."}
      </p>

      {isRegister && (
        <div className="mt-6">
          <label className="label" htmlFor="name">
            Name <span className="font-normal normal-case text-zinc-600">optional</span>
          </label>
          <input id="name" name="name" className="input" autoComplete="name" />
        </div>
      )}

      <div className="mt-4">
        <label className="label" htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="input"
          autoComplete="email"
          placeholder="you@business.com"
        />
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={isRegister ? 10 : undefined}
          className="input"
          autoComplete={isRegister ? "new-password" : "current-password"}
          placeholder={isRegister ? "At least 10 characters" : "••••••••••"}
        />
      </div>

      {state.error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <Submit label={isRegister ? "Create account" : "Sign in"} />

      <p className="mt-4 text-center text-sm text-zinc-500">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-cyan-500 hover:text-cyan-400">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account?{" "}
            <Link href="/register" className="font-semibold text-cyan-500 hover:text-cyan-400">
              Create one
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
