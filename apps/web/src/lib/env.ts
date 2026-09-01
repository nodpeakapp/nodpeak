/** Reads the public origin with no trailing slash. */
export function appUrl(): string {
  const raw = process.env.APP_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

/**
 * The free public "SEO & Reputation Grader" (/grader) is Nodpeak's own
 * top-of-funnel marketing tool, not a feature of any customer's project.
 * It defaults OFF so a self-hosted install doesn't come with someone
 * else's lead-gen page bolted onto their domain — only the canonical
 * nodpeak.com deployment sets ENABLE_GRADER=true.
 */
export function graderEnabled(): boolean {
  return (process.env.ENABLE_GRADER ?? "").trim().toLowerCase() === "true";
}

export function requireSecret(name: string): string {
  const v = process.env[name];
  if (!v || v.startsWith("change-me")) {
    throw new Error(
      `${name} is unset or still the placeholder. Generate one with: openssl rand -base64 48`,
    );
  }
  return v;
}
