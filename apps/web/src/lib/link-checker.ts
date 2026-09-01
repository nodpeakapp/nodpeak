/**
 * Broken-link finder.
 *
 * Fetches one page (via safeFetchHtml, already SSRF-guarded), pulls every
 * <a href> out of it, and HEAD-checks each one — falling back to a ranged
 * GET when a server rejects HEAD, which is common enough to be worth the
 * extra round trip rather than reporting a false positive.
 *
 * Every candidate link is re-validated against the same private-address
 * block list as the page fetch itself: the set of URLs to check comes from
 * page content, which is exactly the untrusted input SSRF guards exist for.
 */

import { parse } from "node-html-parser";
import { assertPublicHost } from "./safe-fetch";

export type LinkFinding = { url: string; status: number | null; text: string };

const MAX_LINKS = 40;
const CONCURRENCY = 6;
const CHECK_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 4;

export function extractLinks(html: string, baseUrl: string): Array<{ url: string; text: string }> {
  const root = parse(html, { blockTextElements: { script: true, style: true } });
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const out: Array<{ url: string; text: string }> = [];

  for (const a of root.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href")?.trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(href)) continue;

    let abs: URL;
    try {
      abs = new URL(href, base);
    } catch {
      continue;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
    abs.hash = "";

    const key = abs.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ url: key, text: a.text.trim().slice(0, 80) || "(no link text)" });
    if (out.length >= MAX_LINKS) break;
  }

  return out;
}

/** HEAD (falling back to GET) with the same private-address guard as the page fetch, followed manually so every redirect hop is re-checked. */
async function checkOne(rawUrl: string): Promise<number | null> {
  let url = new URL(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    try {
      await assertPublicHost(url.hostname);
    } catch {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "NodpeakBot/0.1 (+https://github.com/nodpeakapp/nodpeak)" },
      });
    } catch {
      clearTimeout(timer);
      return null;
    }
    clearTimeout(timer);

    // Some servers 405 or 501 a HEAD request. One GET retry, not a habit.
    if (res.status === 405 || res.status === 501) {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), CHECK_TIMEOUT_MS);
      try {
        res = await fetch(url.toString(), {
          method: "GET",
          redirect: "manual",
          signal: controller2.signal,
          headers: { "User-Agent": "NodpeakBot/0.1 (+https://github.com/nodpeakapp/nodpeak)" },
        });
      } catch {
        clearTimeout(timer2);
        return null;
      }
      clearTimeout(timer2);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res.status;
      try {
        url = new URL(location, url);
      } catch {
        return res.status;
      }
      continue;
    }

    return res.status;
  }

  return 310; // too many redirects — surfaced as a finding, not a crash
}

export async function checkLinks(links: Array<{ url: string; text: string }>): Promise<LinkFinding[]> {
  const results: LinkFinding[] = new Array(links.length);
  let cursor = 0;

  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= links.length) return;
      const status = await checkOne(links[i]!.url);
      results[i] = { url: links[i]!.url, text: links[i]!.text, status };
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, links.length) }, worker));
  return results;
}

export function isBroken(status: number | null): boolean {
  return status === null || status >= 400;
}
