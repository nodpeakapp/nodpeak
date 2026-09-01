/**
 * Runs once when the Next.js server process starts. Used here to drive the
 * uptime monitor: this is a single long-running Docker container (see the
 * repo's Dockerfile), not a serverless deploy, so an in-process interval is
 * the honest, dependency-free way to get periodic checks without standing up
 * a job queue for one feature. It will NOT run on a serverless platform
 * (Vercel, Lambda) — those cold-start and freeze between requests, so this
 * timer would never fire. Documented rather than silently broken there.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Dev's hot-reload can re-import this module; a global guard keeps the
  // interval singular across reloads instead of stacking pollers.
  const g = globalThis as unknown as { __nodpeakUptimeTimer?: NodeJS.Timeout };
  if (g.__nodpeakUptimeTimer) return;

  const { runDueChecks } = await import("./lib/uptime");

  const tick = async () => {
    try {
      await runDueChecks();
    } catch (err) {
      console.warn("[uptime] check pass failed:", (err as Error).message);
    }
  };

  g.__nodpeakUptimeTimer = setInterval(() => void tick(), 60_000);
  void tick();
}
