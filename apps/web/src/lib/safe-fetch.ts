/**
 * SSRF-resistant fetch for the SEO audit endpoint.
 *
 * The audit takes a URL from an untrusted caller and fetches it from inside
 * the container — the textbook server-side request forgery setup. Three
 * things have to hold, and the third is the one people miss:
 *
 *   1. Scheme must be http/https.
 *   2. The resolved IP must not be private, loopback, link-local or CGNAT.
 *   3. **Every hop of a redirect chain must be re-checked.** Validating only
 *      the URL the caller supplied and then following redirects with
 *      `redirect: "follow"` is not a guard at all — `evil.com` 302s to
 *      `http://169.254.169.254/latest/meta-data/` and the cloud metadata
 *      service answers. Redirects are followed manually here for that reason.
 */

import { lookup } from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 4;
const DEFAULT_TIMEOUT = Number(process.env.SEO_AUDIT_TIMEOUT_MS ?? 10_000);
const DEFAULT_MAX_BYTES = Number(process.env.SEO_AUDIT_MAX_BYTES ?? 2_000_000);

export class UnsafeUrlError extends Error {}

function ipv4ToLong(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToLong(ip);
  const inRange = (cidr: string) => {
    const [base, bitsRaw] = cidr.split("/");
    const bits = Number(bitsRaw);
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToLong(base!) & mask);
  };
  return [
    "0.0.0.0/8",       // this network
    "10.0.0.0/8",      // private
    "100.64.0.0/10",   // CGNAT
    "127.0.0.0/8",     // loopback
    "169.254.0.0/16",  // link-local + cloud metadata
    "172.16.0.0/12",   // private
    "192.0.0.0/24",
    "192.168.0.0/16",  // private
    "198.18.0.0/15",   // benchmarking
    "224.0.0.0/4",     // multicast
    "240.0.0.0/4",     // reserved
  ].some(inRange);
}

function isBlockedIPv6(ip: string): boolean {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (s === "::" || s === "::1") return true;
  if (s.startsWith("fe80") || s.startsWith("fc") || s.startsWith("fd")) return true;
  // IPv4-mapped (::ffff:10.0.0.1) — unwrap and re-check.
  const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]!);
  return false;
}

/** Exported so other fetchers of untrusted, page-supplied URLs (the broken-link checker, the uptime monitor) share this one SSRF guard rather than re-implementing it. */
export async function assertPublicHost(hostname: string): Promise<void> {
  const literal = hostname.replace(/^\[|\]$/g, "");
  if (net.isIPv4(literal)) {
    if (isBlockedIPv4(literal)) throw new UnsafeUrlError("Refusing to fetch a private address");
    return;
  }
  if (net.isIPv6(literal)) {
    if (isBlockedIPv6(literal)) throw new UnsafeUrlError("Refusing to fetch a private address");
    return;
  }

  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(hostname)) {
    throw new UnsafeUrlError("Refusing to fetch an internal hostname");
  }

  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError(`Could not resolve ${hostname}`);
  }
  if (records.length === 0) throw new UnsafeUrlError(`Could not resolve ${hostname}`);

  for (const { address, family } of records) {
    const blocked = family === 6 ? isBlockedIPv6(address) : isBlockedIPv4(address);
    if (blocked) throw new UnsafeUrlError("Refusing to fetch a private address");
  }
}

export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();

  // Reject a declared non-http scheme BEFORE defaulting, so `file:///etc/passwd`
  // is refused for what it is rather than silently rewritten to
  // `https://file:///etc/passwd` and rejected with a confusing DNS error.
  //
  // The `//` in the pattern matters: without it, `example.com:8080/path` parses
  // as scheme "example.com" and a legitimate host:port input gets rejected.
  const hierarchical = /^([a-z][a-z0-9+.-]*):\/\//i.exec(trimmed)?.[1]?.toLowerCase();
  if (hierarchical && hierarchical !== "http" && hierarchical !== "https") {
    throw new UnsafeUrlError(`Only http and https URLs can be audited, not ${hierarchical}:`);
  }
  // Opaque schemes carry no `//` and must be named explicitly.
  const opaque = /^(javascript|data|vbscript|blob|about|mailto|tel|file):/i.exec(trimmed)?.[1];
  if (opaque) {
    throw new UnsafeUrlError(`Only http and https URLs can be audited, not ${opaque.toLowerCase()}:`);
  }

  const withScheme = hierarchical ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new UnsafeUrlError("Not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs can be audited");
  }
  url.hash = "";
  return url;
}

export type SafeFetchResult = {
  finalUrl: string;
  status: number;
  html: string;
  bytes: number;
  truncated: boolean;
  redirects: number;
  elapsedMs: number;
};

export async function safeFetchHtml(
  rawUrl: string,
  { timeoutMs = DEFAULT_TIMEOUT, maxBytes = DEFAULT_MAX_BYTES } = {},
): Promise<SafeFetchResult> {
  let url = normalizeUrl(rawUrl);
  const started = Date.now();
  let redirects = 0;

  for (;;) {
    await assertPublicHost(url.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        redirect: "manual", // every hop is re-validated above
        signal: controller.signal,
        headers: {
          "User-Agent": "NodpeakBot/0.1 (+https://github.com/nodpeakapp/nodpeak)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        throw new UnsafeUrlError(`Timed out after ${timeoutMs}ms`);
      }
      throw new UnsafeUrlError(`Could not reach ${url.hostname}`);
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new UnsafeUrlError("Redirect with no Location header");
      if (++redirects > MAX_REDIRECTS) throw new UnsafeUrlError("Too many redirects");
      url = normalizeUrl(new URL(location, url).toString());
      continue;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      throw new UnsafeUrlError(`Expected HTML, got ${contentType.split(";")[0]}`);
    }

    // Stream with a hard byte ceiling — Content-Length can lie.
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    let truncated = false;

    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          chunks.push(value.subarray(0, value.byteLength - (bytes - maxBytes)));
          truncated = true;
          await reader.cancel();
          bytes = maxBytes;
          break;
        }
        chunks.push(value);
      }
    }

    return {
      finalUrl: url.toString(),
      status: res.status,
      html: Buffer.concat(chunks).toString("utf8"),
      bytes,
      truncated,
      redirects,
      elapsedMs: Date.now() - started,
    };
  }
}
