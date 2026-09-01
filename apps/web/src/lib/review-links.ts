/** Deep link that opens the Google review composer for a place. */
export function googleReviewUrl(placeId: string | null): string | null {
  if (!placeId?.trim()) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId.trim())}`;
}

/** Trustpilot's evaluate page. The slug is the business's domain on Trustpilot. */
export function trustpilotReviewUrl(slug: string | null): string | null {
  if (!slug?.trim()) return null;
  const clean = slug.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "");
  return `https://www.trustpilot.com/evaluate/${encodeURIComponent(clean)}`;
}
