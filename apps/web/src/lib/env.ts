/** Reads the public origin with no trailing slash. */
export function appUrl(): string {
  const raw = process.env.APP_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
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
