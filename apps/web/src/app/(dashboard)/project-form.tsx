"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary mt-4" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function NewProjectForm({
  action,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useActionState(action, { error: null } as ActionState);

  return (
    <form action={formAction} className="panel p-6">
      <h2 className="text-base font-semibold">Add a project</h2>
      <p className="mt-1 text-sm text-zinc-400">
        One project per website. The domain is used for the embed snippet and the schema.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="np-name">Business name</label>
          <input id="np-name" name="name" required className="input" placeholder="Acme Plumbing" />
        </div>
        <div>
          <label className="label" htmlFor="np-domain">Domain</label>
          <input id="np-domain" name="domain" required className="input" placeholder="acmeplumbing.com" />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}

      <Submit label="Create project" />
    </form>
  );
}
