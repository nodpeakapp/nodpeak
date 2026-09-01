/**
 * SQLite has no ENUM type, so these string unions are the schema.
 * Every write path must run its value through the guards below.
 */

export const PLANS = ["FREE", "HOSTED"] as const;
export type Plan = (typeof PLANS)[number];
export const isPlan = (v: unknown): v is Plan =>
  typeof v === "string" && (PLANS as readonly string[]).includes(v);

export const SENTIMENTS = ["POSITIVE", "NEUTRAL", "NEGATIVE"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];
export const isSentiment = (v: unknown): v is Sentiment =>
  typeof v === "string" && (SENTIMENTS as readonly string[]).includes(v);

export const WIDGET_PLACEMENTS = ["bubble", "inline"] as const;
export type WidgetPlacement = (typeof WIDGET_PLACEMENTS)[number];
export const isWidgetPlacement = (v: unknown): v is WidgetPlacement =>
  typeof v === "string" && (WIDGET_PLACEMENTS as readonly string[]).includes(v);

export const LEAD_STATUSES = ["NEW", "READ", "ARCHIVED"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const isLeadStatus = (v: unknown): v is LeadStatus =>
  typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);

export const UPTIME_STATUSES = ["UP", "DOWN"] as const;
export type UptimeStatus = (typeof UPTIME_STATUSES)[number];

/** Plan capabilities. In selfhost mode every user gets HOSTED limits. */
export const PLAN_LIMITS: Record<Plan, { projects: number; reviews: number }> = {
  FREE: {
    projects: Number(process.env.FREE_PROJECT_LIMIT ?? 1),
    reviews: Number(process.env.FREE_REVIEW_LIMIT ?? 50),
  },
  HOSTED: {
    projects: Number(process.env.HOSTED_PROJECT_LIMIT ?? 25),
    reviews: Number.POSITIVE_INFINITY,
  },
};

export const isSelfHost = () =>
  (process.env.DEPLOYMENT_MODE ?? "selfhost").toLowerCase() !== "cloud";

export function limitsFor(plan: string) {
  if (isSelfHost()) return PLAN_LIMITS.HOSTED;
  return PLAN_LIMITS[isPlan(plan) ? plan : "FREE"];
}
