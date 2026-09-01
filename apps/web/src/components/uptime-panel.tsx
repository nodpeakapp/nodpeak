"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Activity, CheckCircle2, XCircle } from "lucide-react";

type State = { error: string | null; ok?: boolean };

export type UptimeStatus = {
  enabled: boolean;
  url: string | null;
  notifyEmail: string | null;
  intervalMinutes: number;
  lastStatus: "UP" | "DOWN" | null;
  lastCheckedAt: string | null;
  consecutiveFails: number;
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary mt-4" disabled={pending}>
      {pending ? "Saving…" : "Save monitor"}
    </button>
  );
}

export function UptimePanel({
  projectId,
  status,
  action,
}: {
  projectId: string;
  status: UptimeStatus;
  action: (prev: State, fd: FormData) => Promise<State>;
}) {
  const [state, formAction] = useActionState(action, { error: null } as State);

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-cyan-500" />
        <h2 className="text-base font-semibold">Uptime monitor</h2>
        {status.enabled && status.lastStatus && (
          <span
            className={`ml-auto flex items-center gap-1 chip !py-0.5 !text-[10px] ${
              status.lastStatus === "UP" ? "border-emerald-900/60 text-emerald-300" : "border-red-900/60 text-red-300"
            }`}
          >
            {status.lastStatus === "UP" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {status.lastStatus}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-400">
        Checked every few minutes from this install. Status shows here on the dashboard — email
        alerts need an email provider configured on the server, so they aren&rsquo;t wired up yet.
      </p>

      {status.enabled && status.lastCheckedAt && (
        <p className="mt-3 text-xs text-zinc-500">
          Last checked {new Date(status.lastCheckedAt).toISOString().slice(0, 16).replace("T", " ")} UTC
          {status.consecutiveFails > 0 && (
            <span className="text-red-400"> · {status.consecutiveFails} check{status.consecutiveFails === 1 ? "" : "s"} in a row failed</span>
          )}
        </p>
      )}

      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="projectId" value={projectId} />
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-100">
          <input type="checkbox" name="enabled" defaultChecked={status.enabled} className="h-4 w-4 accent-cyan-500" />
          Monitor this site
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="uptime-url">URL to check</label>
            <input id="uptime-url" name="url" type="url" defaultValue={status.url ?? ""} className="input" placeholder="https://acmeplumbing.com" />
          </div>
          <div>
            <label className="label" htmlFor="uptime-interval">Check every</label>
            <select id="uptime-interval" name="intervalMinutes" defaultValue={String(status.intervalMinutes)} className="input">
              <option value="1">1 minute</option>
              <option value="5">5 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="uptime-email">Notify email (stored for when alerting ships)</label>
          <input id="uptime-email" name="notifyEmail" type="email" defaultValue={status.notifyEmail ?? ""} className="input" placeholder="you@business.com" />
        </div>

        {state.error && (
          <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <Submit />
      </form>
    </div>
  );
}
