"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type State = { error: string | null; ok?: boolean };

type Project = {
  id: string;
  name: string;
  domain: string;
  googlePlaceId: string | null;
  trustpilotSlug: string | null;
  webhookUrl: string | null;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary mt-5" disabled={pending}>
      {pending ? "Saving…" : "Save project"}
    </button>
  );
}

export function SettingsForm({
  project,
  action,
}: {
  project: Project;
  action: (prev: State, fd: FormData) => Promise<State>;
}) {
  const [state, formAction] = useActionState(action, { error: null } as State);

  return (
    <form action={formAction} className="panel p-6">
      <input type="hidden" name="projectId" value={project.id} />
      <h2 className="text-base font-semibold">Project</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Business name</label>
          <input id="name" name="name" defaultValue={project.name} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="domain">Domain</label>
          <input id="domain" name="domain" defaultValue={project.domain} className="input" required />
        </div>
      </div>

      <h3 className="mt-8 text-sm font-semibold">Where happy customers go</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-400">
        For a local business this is the part that actually moves search — Google Business
        Profile stars in the Maps pack, not markup on your own site.
      </p>

      <div className="mt-4">
        <label className="label" htmlFor="googlePlaceId">Google Place ID</label>
        <input
          id="googlePlaceId"
          name="googlePlaceId"
          defaultValue={project.googlePlaceId ?? ""}
          className="input font-mono"
          placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
        />
        <p className="mt-1.5 text-xs text-zinc-500">
          Find it with Google&apos;s{" "}
          <a
            href="https://developers.google.com/maps/documentation/places/web-service/place-id"
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-500 hover:text-cyan-400"
          >
            Place ID finder
          </a>
          .
        </p>
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="trustpilotSlug">Trustpilot domain</label>
        <input
          id="trustpilotSlug"
          name="trustpilotSlug"
          defaultValue={project.trustpilotSlug ?? ""}
          className="input"
          placeholder="acmeplumbing.com"
        />
      </div>

      <h3 className="mt-8 text-sm font-semibold">Webhook</h3>
      <div className="mt-3">
        <label className="label" htmlFor="webhookUrl">POST every new review to</label>
        <input
          id="webhookUrl"
          name="webhookUrl"
          type="url"
          defaultValue={project.webhookUrl ?? ""}
          className="input font-mono"
          placeholder="https://hooks.example.com/nodpeak"
        />
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          Fired without waiting for a response, so a slow endpoint never delays a customer.
          Failures are not retried.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state.ok && !state.error && (
        <p className="mt-4 rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          Saved.
        </p>
      )}

      <Submit />
    </form>
  );
}
