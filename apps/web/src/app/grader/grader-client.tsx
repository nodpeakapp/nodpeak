"use client";

import { useMemo, useState } from "react";
import {
  Gauge,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Loader2,
  Star,
  ArrowRight,
  Github,
} from "lucide-react";

type Severity = "critical" | "warning" | "info" | "pass";
type Finding = { id: string; label: string; severity: Severity; detail: string };

type AuditResponse = {
  ok: boolean;
  error?: string;
  url?: string;
  score?: number;
  mobileSpeed?: number;
  mobileSpeedSource?: "pagespeed" | "estimated";
  missingMetaCount?: number;
  schemaValid?: boolean;
  jsonLd?: { hasAggregateRating: boolean; selfServingWarning: boolean };
  findings?: Finding[];
};

const ICON: Record<Severity, React.ReactNode> = {
  critical: <XCircle className="h-4 w-4 shrink-0 text-red-400" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />,
  info: <Info className="h-4 w-4 shrink-0 text-sky-400" />,
  pass: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />,
};

const ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2, pass: 3 };

function grade(score: number): { label: string; tone: string } {
  if (score >= 85) return { label: "Strong", tone: "text-emerald-400" };
  if (score >= 65) return { label: "Needs work", tone: "text-amber-400" };
  return { label: "Struggling", tone: "text-red-400" };
}

export function GraderClient() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResponse | null>(null);

  const [email, setEmail] = useState("");
  const [leadState, setLeadState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const findings = useMemo(
    () => (result?.findings ?? []).slice().sort((a, b) => ORDER[a.severity] - ORDER[b.severity]),
    [result],
  );

  async function runAudit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLeadState("idle");
    try {
      const target = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      const res = await fetch("/api/v1/seo-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = (await res.json()) as AuditResponse;
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Couldn't audit that page (${res.status})`);
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function sendLead(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !result?.url) return;
    setLeadState("sending");
    try {
      const res = await fetch("/api/v1/grader-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          url: result.url,
          score: result.score ?? 0,
          sourceUrl: typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      if (!res.ok) throw new Error();
      setLeadState("sent");
    } catch {
      setLeadState("error");
    }
  }

  const g = result?.score !== undefined ? grade(result.score) : null;
  const reviewsEligible =
    result?.jsonLd?.hasAggregateRating && !result.jsonLd.selfServingWarning;
  const reviewsBlocked = result?.jsonLd?.selfServingWarning;

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        {/* Hero */}
        <div className="text-center">
          <span className="chip mx-auto w-fit border-cyan-700/50 bg-cyan-500/5 text-cyan-300">
            Free · No signup · 15 seconds
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
            What&rsquo;s your site actually scoring?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base leading-relaxed text-zinc-400">
            Paste a URL. Get an honest read on your on-page SEO, mobile speed, and — the part most
            tools won&rsquo;t tell you — whether your review stars can even show up in Google search.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={runAudit} className="panel mt-10 flex flex-col gap-2 p-3 sm:flex-row">
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourbusiness.com"
            spellCheck={false}
            autoFocus
          />
          <button type="submit" disabled={loading} className="btn-primary shrink-0 sm:px-6">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
            {loading ? "Grading…" : "Grade my site"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-center text-sm text-red-300">
            {error}
          </p>
        )}

        {/* Results */}
        {result && g && (
          <div className="mt-12 animate-fade-up">
            <div className="panel flex flex-col items-center gap-2 p-8 text-center">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Overall score for {new URL(result.url ?? url).hostname}
              </div>
              <div className={`text-7xl font-bold tabular-nums ${g.tone}`}>{result.score}</div>
              <div className={`text-sm font-semibold ${g.tone}`}>{g.label}</div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric
                label={result.mobileSpeedSource === "pagespeed" ? "Mobile speed" : "Mobile speed (est.)"}
                value={String(result.mobileSpeed ?? 0)}
              />
              <Metric label="Missing meta tags" value={String(result.missingMetaCount ?? 0)} />
              <Metric
                label="Schema"
                value={result.schemaValid ? "valid" : "none found"}
                warn={!result.schemaValid}
              />
            </div>

            {/* The differentiated insight */}
            <div
              className={`panel mt-4 flex items-start gap-3 p-5 ${
                reviewsBlocked ? "border-red-900/50 bg-red-950/10" : reviewsEligible ? "border-emerald-900/50 bg-emerald-950/10" : ""
              }`}
            >
              <Star className={`mt-0.5 h-5 w-5 shrink-0 ${reviewsBlocked ? "text-red-400" : reviewsEligible ? "text-emerald-400" : "text-zinc-500"}`} />
              <div>
                <div className="text-sm font-semibold">
                  {reviewsBlocked
                    ? "Your review schema is set up wrong — Google will show zero stars"
                    : reviewsEligible
                      ? "Your review schema is eligible for star ratings in search"
                      : "No review schema found yet"}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                  {reviewsBlocked
                    ? "AggregateRating is sitting on a LocalBusiness/Organization type. It'll validate in Google's own testing tool and still produce zero stars in real results — Google excludes self-serving reviews on that markup. Most review tools never mention this."
                    : reviewsEligible
                      ? "Nice — your markup is on a type Google actually renders star ratings for. Keep the review count growing and this keeps working."
                      : "Without AggregateRating markup, even a great rating on Google Business Profile won't show a star snippet under this page in search."}
                </p>
              </div>
            </div>

            <ul className="mt-4 divide-y divide-surface-800 border-t border-surface-800">
              {findings.map((f) => (
                <li key={f.id} className="flex gap-3 py-3">
                  {ICON[f.severity]}
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="mt-0.5 break-words text-sm leading-relaxed text-zinc-400">{f.detail}</div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Lead capture + CTAs */}
            <div className="panel mt-8 p-6">
              {leadState !== "sent" ? (
                <>
                  <h2 className="text-base font-semibold">Get the fix-it checklist</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Email this report to yourself, plus a free re-check in 30 days so you can see what improved.
                  </p>
                  <form onSubmit={sendLead} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      required
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@yourbusiness.com"
                    />
                    <button type="submit" disabled={leadState === "sending"} className="btn-ghost shrink-0">
                      {leadState === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Send it to me
                    </button>
                  </form>
                  {leadState === "error" && (
                    <p className="mt-2 text-xs text-red-300">Couldn&rsquo;t save that — try again in a moment.</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-emerald-300">
                  Done — that&rsquo;s saved. Now, the part that actually moves this score: asking your customers for reviews at the right moment, and fixing what&rsquo;s above.
                </p>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-surface-800 pt-6 sm:flex-row">
                <a
                  href="https://github.com/nodpeakapp/nodpeak"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-ghost flex-1"
                >
                  <Github className="h-4 w-4" />
                  Fix it yourself — self-host free
                </a>
                <a href="/register" className="btn-primary flex-1">
                  Let Nodpeak run it — $15/mo
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        )}

        {!result && (
          <p className="mt-8 text-center text-xs leading-relaxed text-zinc-600">
            Reads the HTML your server returns — same as a search crawler sees. Nothing is stored
            unless you ask for the report by email above.
          </p>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-surface-700 bg-surface-950/50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${warn ? "text-amber-400" : "text-zinc-100"}`}>
        {value}
      </div>
    </div>
  );
}
