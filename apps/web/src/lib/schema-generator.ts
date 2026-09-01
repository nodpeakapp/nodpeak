/**
 * JSON-LD generation for review rich results.
 *
 * ─── READ THIS BEFORE SHIPPING TO A CLIENT ──────────────────────────────
 * Google does NOT show review rich results for self-serving reviews on
 * `LocalBusiness` or `Organization` markup — that is, a business publishing
 * ratings collected about itself, on its own site. Those two types are
 * explicitly excluded from the review snippet feature.
 *
 * What that means in practice:
 *   • `Product`, `Service`, `Recipe`, `Book`, `Course`, `Event` and friends
 *     are eligible and are what Nodpeak targets by default.
 *   • For a local business, the honest play is Google Business Profile
 *     stars in the Maps pack — which is exactly why the widget routes
 *     4–5 star reviewers to Google rather than keeping them on-site.
 *   • Marking up a plumber's homepage as LocalBusiness + AggregateRating
 *     will validate, and will not produce stars. Anyone selling that as an
 *     SEO win is selling a validator screenshot.
 *
 * `defaultSchemaType` is therefore "Service", and the UI warns when a user
 * picks LocalBusiness or Organization.
 * ────────────────────────────────────────────────────────────────────────
 */

import { appUrl } from "./env";

export const RICH_RESULT_ELIGIBLE_TYPES = [
  "Product",
  "Service",
  "Course",
  "Event",
  "Book",
  "Recipe",
  "SoftwareApplication",
] as const;

export const SELF_SERVING_EXCLUDED_TYPES = ["LocalBusiness", "Organization"] as const;

export type SchemaType =
  | (typeof RICH_RESULT_ELIGIBLE_TYPES)[number]
  | (typeof SELF_SERVING_EXCLUDED_TYPES)[number];

export const defaultSchemaType: SchemaType = "Service";

export function isRichResultEligible(type: string): boolean {
  return (RICH_RESULT_ELIGIBLE_TYPES as readonly string[]).includes(type);
}

export type ReviewForSchema = {
  id: string;
  rating: number;
  customerName: string | null;
  comment: string | null;
  createdAt: Date | string;
};

export type AggregateStats = {
  count: number;
  average: number;
  best: number;
  worst: number;
};

/** Rounds to one decimal — Google rejects long floating point tails. */
export function aggregate(reviews: Array<{ rating: number }>): AggregateStats {
  const rated = reviews.filter((r) => r.rating >= 1 && r.rating <= 5);
  const count = rated.length;
  const average =
    count === 0 ? 0 : Math.round((rated.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
  return { count, average, best: 5, worst: 1 };
}

type BuildArgs = {
  projectId: string;
  name: string;
  domain: string;
  reviews: ReviewForSchema[];
  schemaType?: SchemaType;
  /** Include up to N individual Review nodes alongside the aggregate. */
  includeIndividual?: number;
};

/**
 * Builds the JSON-LD node. Returns null when there is nothing honest to
 * claim — zero public reviews means no markup, not an empty AggregateRating.
 * A `reviewCount` of 0 is a structured-data error, and an install that
 * emits one on every page is worse than emitting nothing.
 */
export function buildAggregateRatingSchema({
  projectId,
  name,
  domain,
  reviews,
  schemaType = defaultSchemaType,
  includeIndividual = 5,
}: BuildArgs): Record<string, unknown> | null {
  const stats = aggregate(reviews);
  if (stats.count === 0) return null;

  const site = domain.startsWith("http") ? domain : `https://${domain}`;

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${site}#nodpeak-${projectId}`,
    name,
    url: site,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: stats.average,
      reviewCount: stats.count,
      bestRating: stats.best,
      worstRating: stats.worst,
    },
  };

  const individual = reviews
    .filter((r) => r.comment && r.comment.trim().length > 0)
    .slice(0, includeIndividual)
    .map((r) => ({
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { "@type": "Person", name: r.customerName?.trim() || "Verified customer" },
      reviewBody: r.comment!.trim().slice(0, 500),
      datePublished: new Date(r.createdAt).toISOString().slice(0, 10),
    }));

  if (individual.length > 0) node.review = individual;

  // Provenance — makes the markup auditable and is how the badge is earned.
  node.isPartOf = {
    "@type": "WebSite",
    url: site,
    publisher: { "@type": "Organization", name: "Nodpeak", url: appUrl() },
  };

  return node;
}

/** Escapes `</script` so the payload cannot break out of its own tag. */
export function serializeJsonLd(node: Record<string, unknown>): string {
  return JSON.stringify(node).replace(/</g, "\\u003c");
}

/** What the Google result will actually look like, for the dashboard preview. */
export function snippetPreview(stats: AggregateStats) {
  const full = Math.floor(stats.average);
  const half = stats.average - full >= 0.5;
  return {
    stars: "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - (half ? 1 : 0)),
    ratingText: `Rating: ${stats.average.toFixed(1)} · ${stats.count} review${stats.count === 1 ? "" : "s"}`,
    eligible: stats.count > 0,
  };
}
