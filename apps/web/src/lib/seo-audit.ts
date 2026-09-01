/**
 * Lightweight on-page audit.
 *
 * Scope is deliberately narrow and honest: this reads the HTML the server
 * returned. It does not execute JavaScript, so a client-rendered site will
 * look emptier than it is — that limitation is reported in the findings
 * rather than papered over with a confident low score.
 *
 * `mobileSpeed` is a real Lighthouse performance score when
 * PAGESPEED_API_KEY is set. Without a key it is a page-weight heuristic and
 * is labelled `estimated` so nobody puts it in a client report as measured.
 */

import { parse } from "node-html-parser";

export type Severity = "critical" | "warning" | "info" | "pass";

export type Finding = {
  id: string;
  label: string;
  severity: Severity;
  detail: string;
};

export type MetaSnapshot = {
  title: string | null;
  titleLength: number;
  description: string | null;
  descriptionLength: number;
  canonical: string | null;
  h1: string[];
  imageCount: number;
  imagesMissingAlt: number;
  ogTags: number;
  viewport: string | null;
  lang: string | null;
  robotsMeta: string | null;
};

export type JsonLdReport = {
  blocks: number;
  valid: boolean;
  parseErrors: string[];
  types: string[];
  hasAggregateRating: boolean;
  /** AggregateRating on a type Google excludes from review snippets. */
  selfServingWarning: boolean;
};

export type AuditResult = {
  url: string;
  score: number;
  mobileSpeed: number;
  mobileSpeedSource: "pagespeed" | "estimated";
  missingMetaCount: number;
  schemaValid: boolean;
  meta: MetaSnapshot;
  jsonLd: JsonLdReport;
  findings: Finding[];
  pageBytes: number;
};

const EXCLUDED_FROM_REVIEW_SNIPPETS = ["LocalBusiness", "Organization"];
const LOCAL_BUSINESS_SUBTYPES =
  /Store|Restaurant|Dentist|Plumber|Electrician|AutoRepair|RealEstateAgent|Attorney|MedicalBusiness|HomeAndConstructionBusiness|ProfessionalService|LodgingBusiness/;

export function extractMeta(html: string): MetaSnapshot {
  const root = parse(html, { blockTextElements: { script: true, style: true } });

  const metaContent = (selector: string) =>
    root.querySelector(selector)?.getAttribute("content")?.trim() || null;

  const title = root.querySelector("title")?.text?.trim() || null;
  const description = metaContent('meta[name="description"]');
  const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim() || null;
  const h1 = root.querySelectorAll("h1").map((n) => n.text.trim()).filter(Boolean);

  const images = root.querySelectorAll("img");
  const imagesMissingAlt = images.filter((img) => {
    const alt = img.getAttribute("alt");
    return alt === undefined || alt === null;
  }).length;

  return {
    title,
    titleLength: title?.length ?? 0,
    description,
    descriptionLength: description?.length ?? 0,
    canonical,
    h1,
    imageCount: images.length,
    imagesMissingAlt,
    ogTags: root.querySelectorAll('meta[property^="og:"]').length,
    viewport: metaContent('meta[name="viewport"]'),
    lang: root.querySelector("html")?.getAttribute("lang")?.trim() || null,
    robotsMeta: metaContent('meta[name="robots"]'),
  };
}

export function extractJsonLd(html: string): JsonLdReport {
  const root = parse(html, { blockTextElements: { script: true, style: true } });
  const nodes = root.querySelectorAll('script[type="application/ld+json"]');

  const types: string[] = [];
  const parseErrors: string[] = [];
  let hasAggregateRating = false;
  let selfServingWarning = false;

  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    const obj = value as Record<string, unknown>;

    const t = obj["@type"];
    const typeList = Array.isArray(t) ? t : t ? [t] : [];
    for (const entry of typeList) if (typeof entry === "string") types.push(entry);

    if (obj.aggregateRating) {
      hasAggregateRating = true;
      const excluded = typeList.some(
        (entry) =>
          typeof entry === "string" &&
          (EXCLUDED_FROM_REVIEW_SNIPPETS.includes(entry) || LOCAL_BUSINESS_SUBTYPES.test(entry)),
      );
      if (excluded) selfServingWarning = true;
    }

    if (Array.isArray(obj["@graph"])) walk(obj["@graph"]);
    for (const v of Object.values(obj)) if (v && typeof v === "object") walk(v);
  };

  for (const [i, node] of nodes.entries()) {
    const raw = node.text.trim();
    if (!raw) {
      parseErrors.push(`Block ${i + 1} is empty`);
      continue;
    }
    try {
      walk(JSON.parse(raw));
    } catch (err) {
      parseErrors.push(`Block ${i + 1}: ${(err as Error).message}`);
    }
  }

  return {
    blocks: nodes.length,
    valid: nodes.length > 0 && parseErrors.length === 0,
    parseErrors,
    types: [...new Set(types)],
    hasAggregateRating,
    selfServingWarning,
  };
}

/** Page-weight heuristic used only when no PageSpeed key is configured. */
export function estimateMobileSpeed(html: string, bytes: number): number {
  const root = parse(html, { blockTextElements: { script: true, style: true } });
  const blockingScripts = root
    .querySelectorAll("script[src]")
    .filter((s) => !s.hasAttribute("async") && !s.hasAttribute("defer")).length;
  const stylesheets = root.querySelectorAll('link[rel="stylesheet"]').length;
  const images = root.querySelectorAll("img").length;
  const inlineStyleBytes = root.querySelectorAll("style").reduce((n, s) => n + s.text.length, 0);

  let score = 100;
  score -= Math.min(35, (bytes / 1_000_000) * 25);      // page weight
  score -= Math.min(25, blockingScripts * 5);            // render-blocking JS
  score -= Math.min(12, Math.max(0, stylesheets - 2) * 3);
  score -= Math.min(12, Math.max(0, images - 20) * 0.4);
  score -= Math.min(8, inlineStyleBytes / 40_000);
  return Math.max(5, Math.round(score));
}

export async function pagespeedScore(url: string): Promise<number | null> {
  const key = process.env.PAGESPEED_API_KEY?.trim();
  if (!key) return null;
  try {
    const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    api.searchParams.set("url", url);
    api.searchParams.set("strategy", "mobile");
    api.searchParams.set("category", "performance");
    api.searchParams.set("key", key);

    const res = await fetch(api, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lighthouseResult?: { categories?: { performance?: { score?: number } } };
    };
    const raw = data.lighthouseResult?.categories?.performance?.score;
    return typeof raw === "number" ? Math.round(raw * 100) : null;
  } catch {
    return null;
  }
}

export function buildFindings(meta: MetaSnapshot, jsonLd: JsonLdReport, bytes: number): Finding[] {
  const f: Finding[] = [];
  const push = (id: string, label: string, severity: Severity, detail: string) =>
    f.push({ id, label, severity, detail });

  // Title
  if (!meta.title) push("title.missing", "Page title", "critical", "No <title> element. This is the single biggest on-page miss.");
  else if (meta.titleLength < 20) push("title.short", "Page title", "warning", `Only ${meta.titleLength} characters. 30–60 reads better in results.`);
  else if (meta.titleLength > 65) push("title.long", "Page title", "warning", `${meta.titleLength} characters — Google will truncate around 60.`);
  else push("title.ok", "Page title", "pass", `${meta.titleLength} characters.`);

  // Description
  if (!meta.description) push("description.missing", "Meta description", "critical", "No meta description, so Google writes its own snippet.");
  else if (meta.descriptionLength < 70) push("description.short", "Meta description", "warning", `${meta.descriptionLength} characters. 120–158 uses the full snippet.`);
  else if (meta.descriptionLength > 160) push("description.long", "Meta description", "info", `${meta.descriptionLength} characters — will be truncated.`);
  else push("description.ok", "Meta description", "pass", `${meta.descriptionLength} characters.`);

  // Canonical
  if (!meta.canonical) push("canonical.missing", "Canonical URL", "warning", "No canonical link. Duplicate URLs will split ranking signals.");
  else push("canonical.ok", "Canonical URL", "pass", meta.canonical);

  // H1
  if (meta.h1.length === 0) push("h1.missing", "H1 heading", "critical", "No H1 on the page.");
  else if (meta.h1.length > 1) push("h1.multiple", "H1 heading", "warning", `${meta.h1.length} H1 elements. Use one.`);
  else push("h1.ok", "H1 heading", "pass", meta.h1[0]!.slice(0, 80));

  // Images
  if (meta.imageCount > 0 && meta.imagesMissingAlt > 0) {
    const share = Math.round((meta.imagesMissingAlt / meta.imageCount) * 100);
    push("img.alt", "Image alt text", share > 50 ? "critical" : "warning",
      `${meta.imagesMissingAlt} of ${meta.imageCount} images have no alt attribute (${share}%).`);
  } else if (meta.imageCount > 0) {
    push("img.alt.ok", "Image alt text", "pass", `All ${meta.imageCount} images have alt attributes.`);
  }

  // Mobile
  if (!meta.viewport) push("viewport.missing", "Mobile viewport", "critical", "No viewport meta tag — the page will not scale on phones.");
  else push("viewport.ok", "Mobile viewport", "pass", meta.viewport);

  if (!meta.lang) push("lang.missing", "Language attribute", "info", "No lang attribute on <html>.");

  if (meta.robotsMeta && /noindex/i.test(meta.robotsMeta)) {
    push("robots.noindex", "Indexing", "critical", `robots meta is "${meta.robotsMeta}" — this page is excluded from search.`);
  }

  if (meta.ogTags === 0) push("og.missing", "Open Graph tags", "info", "No og: tags, so shared links get no preview card.");

  // Structured data
  if (jsonLd.blocks === 0) {
    push("schema.missing", "Structured data", "warning", "No JSON-LD found. Nothing here can produce a rich result.");
  } else if (!jsonLd.valid) {
    push("schema.invalid", "Structured data", "critical", `JSON-LD present but does not parse: ${jsonLd.parseErrors.join("; ")}`);
  } else {
    push("schema.ok", "Structured data", "pass", `${jsonLd.blocks} valid block(s): ${jsonLd.types.join(", ") || "untyped"}.`);
  }

  if (jsonLd.selfServingWarning) {
    push("schema.selfserving", "Review snippet eligibility", "warning",
      "AggregateRating sits on a LocalBusiness/Organization type. It validates, but Google does not show review stars for self-serving reviews on those types.");
  }

  // Weight
  if (bytes > 1_500_000) push("weight.heavy", "Page weight", "warning", `${(bytes / 1_000_000).toFixed(1)} MB of HTML before assets.`);

  return f;
}

const WEIGHTS: Record<Severity, number> = { critical: 12, warning: 5, info: 1, pass: 0 };

export function scoreFrom(findings: Finding[], mobileSpeed: number): number {
  const penalty = findings.reduce((sum, x) => sum + WEIGHTS[x.severity], 0);
  const onPage = Math.max(0, 100 - penalty);
  // On-page findings carry 70%, measured/estimated speed 30%.
  return Math.round(onPage * 0.7 + mobileSpeed * 0.3);
}

export function countMissingMeta(meta: MetaSnapshot): number {
  return [meta.title, meta.description, meta.canonical, meta.viewport, meta.h1[0]].filter(
    (v) => !v,
  ).length;
}
