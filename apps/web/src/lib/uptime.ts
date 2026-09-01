/**
 * Uptime monitor — the checking half. A monitor is "due" once its interval
 * has elapsed since the last check; runDueChecks() is called on a timer from
 * instrumentation.ts, so this only works in a long-running process (the
 * Docker deploy this repo ships), not on a serverless platform. That's
 * documented rather than hidden — see instrumentation.ts.
 */

import { prisma } from "./db";
import { assertPublicHost } from "./safe-fetch";

const TIMEOUT_MS = 10_000;

export type PingResult = { ok: boolean; statusCode: number | null; latencyMs: number | null; error: string | null };

export async function pingOnce(rawUrl: string): Promise<PingResult> {
  const started = Date.now();
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, statusCode: null, latencyMs: null, error: "Invalid URL" };
  }

  try {
    await assertPublicHost(url.hostname);
  } catch (err) {
    return { ok: false, statusCode: null, latencyMs: null, error: (err as Error).message };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url.toString(), {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "NodpeakBot/0.1 (+https://github.com/nodpeakapp/nodpeak)" },
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url.toString(), {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "NodpeakBot/0.1 (+https://github.com/nodpeakapp/nodpeak)" },
      });
    }
    const latencyMs = Date.now() - started;
    return { ok: res.status < 500, statusCode: res.status, latencyMs, error: null };
  } catch (err) {
    const isTimeout = (err as Error).name === "AbortError";
    return { ok: false, statusCode: null, latencyMs: Date.now() - started, error: isTimeout ? "Timed out" : "Could not reach the site" };
  } finally {
    clearTimeout(timer);
  }
}

/** Finds monitors past their interval, pings each, records a UptimeCheck row and updates the monitor's rolling status. Caps history so a project can't grow the table without bound. */
export async function runDueChecks(): Promise<number> {
  const monitors = await prisma.uptimeMonitor.findMany({
    where: { enabled: true, url: { not: null } },
  });

  const now = Date.now();
  const due = monitors.filter((m) => {
    if (!m.lastCheckedAt) return true;
    return now - m.lastCheckedAt.getTime() >= m.intervalMinutes * 60_000;
  });

  for (const monitor of due) {
    const result = await pingOnce(monitor.url!);

    await prisma.uptimeCheck.create({
      data: {
        projectId: monitor.projectId,
        ok: result.ok,
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
        error: result.error,
      },
    });

    const consecutiveFails = result.ok ? 0 : monitor.consecutiveFails + 1;
    await prisma.uptimeMonitor.update({
      where: { id: monitor.id },
      data: {
        lastStatus: result.ok ? "UP" : "DOWN",
        lastCheckedAt: new Date(),
        consecutiveFails,
      },
    });

    // Old checks beyond the last 200 per project are noise, not history.
    const stale = await prisma.uptimeCheck.findMany({
      where: { projectId: monitor.projectId },
      orderBy: { checkedAt: "desc" },
      skip: 200,
      select: { id: true },
    });
    if (stale.length > 0) {
      await prisma.uptimeCheck.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }
  }

  return due.length;
}
