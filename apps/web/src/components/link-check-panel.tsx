"use client";

import { useState } from "react";
import { Link2, XCircle, Loader2 } from "lucide-react";

type Finding = { url: string; status: number | null; text: string };
type LinkCheckResponse = {
  ok: boolean;
  error?: string;
  url?: string;
  totalLinks?: number;
  brokenCount?: number;
  broken?: Finding[];
};

export function LinkCheckPanel({ projectId, domain }: { projectId: string; domain: string }) {
  const [url, setUrl] = useState(`https://${domain}`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LinkCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/dashboard/link-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, projectId }),
      });
      const data = (await res.json()) as LinkCheckResponse;
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Check failed (${res.status})`);
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-cyan-500" />
        <h2 className="text-base font-semibold">Broken-link finder</h2>
      </div>
      <p className="mt-1 text-sm text-zinc-400">
        Crawls the links on one page and checks each one. Up to 40 links per run.
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
          {loading ? "Checking…" : "Check links"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <>
          <p className="mt-5 text-sm text-zinc-400">
            Checked <span className="font-semibold text-zinc-200">{result.totalLinks}</span> link
            {result.totalLinks === 1 ? "" : "s"} on {result.url}. Found{" "}
            <span className={`font-semibold ${result.brokenCount ? "text-red-400" : "text-emerald-400"}`}>
              {result.brokenCount}
            </span>{" "}
            broken.
          </p>

          {result.broken && result.broken.length > 0 && (
            <ul className="mt-4 divide-y divide-surface-800 border-t border-surface-800">
              {result.broken.map((f, i) => (
                <li key={i} className="flex gap-3 py-3">
                  <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{f.text}</div>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-zinc-500 hover:text-cyan-400"
                    >
                      {f.url}
                    </a>
                  </div>
                  <span className="ml-auto shrink-0 chip !py-0.5 !text-[10px] border-red-900/60 text-red-300">
                    {f.status ?? "unreachable"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
