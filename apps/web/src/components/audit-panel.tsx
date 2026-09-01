"use client";

import { useState } from "react";
import { Gauge, CheckCircle2, AlertTriangle, XCircle, Info, Loader2 } from "lucide-react";

type Finding = { id: string; label: string; severity: "critical" | "warning" | "info" | "pass"; detail: string };

type AuditResponse = {
  ok: boolean;
  error?: string;
  url?: string;
  score?: number;
  mobileSpeed?: number;
  mobileSpeedSource?: "pagespeed" | "estimated";
  missingMetaCount?: number;
  schemaValid?: boolean;
  findings?: Finding[];
};

const ICON = {
  critical: <XCircle className="h-4 w-4 shrink-0 text-red-400" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />,
  info: <Info className="h-4 w-4 shrink-0 text-sky-400" />,
  pass: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />,
};

const ORDER = { critical: 0, warning: 1, info: 2, pass: 3 } as const;

export function AuditPanel({ projectId, domain }: { projectId: string; domain: string }) {
  const [url, setUrl] = useState(`https://${domain}`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/seo-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, projectId }),
      });
      const data = (await res.json()) as AuditResponse;
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Audit failed (${res.status})`);
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const findings = (result?.findings ?? []).slice().sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-cyan-500" />
        <h2 className="text-base font-semibold">On-page audit</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-400">
        Reads the HTML your server returns. It does not run JavaScript — which is exactly
        what a crawler does, so a thin result here is a finding, not a bug.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          className="input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/page"
          spellCheck={false}
        />
        <button onClick={run} disabled={loading} className="btn-primary shrink-0">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {loading ? "Auditing…" : "Run audit"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Score" value={String(result.score ?? 0)} accent />
            <Metric
              label={result.mobileSpeedSource === "pagespeed" ? "Mobile speed" : "Mobile speed (est.)"}
              value={String(result.mobileSpeed ?? 0)}
            />
            <Metric label="Missing meta" value={String(result.missingMetaCount ?? 0)} />
            <Metric label="Schema" value={result.schemaValid ? "valid" : "none"} />
          </div>

          {result.mobileSpeedSource === "estimated" && (
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Speed is a page-weight estimate, not a Lighthouse measurement. Set{" "}
              <code className="text-cyan-400">PAGESPEED_API_KEY</code> for a real number before
              putting this in front of a client.
            </p>
          )}

          <ul className="mt-5 divide-y divide-surface-800 border-t border-surface-800">
            {findings.map((f) => (
              <li key={f.id} className="flex gap-3 py-3">
                {ICON[f.severity]}
                <div className="min-w-0">
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="mt-0.5 break-words text-sm leading-relaxed text-zinc-400">
                    {f.detail}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-surface-700 bg-surface-950/50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ? "text-cyan-500" : ""}`}>
        {value}
      </div>
    </div>
  );
}
