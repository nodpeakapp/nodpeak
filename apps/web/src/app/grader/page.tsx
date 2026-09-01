import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { graderEnabled } from "@/lib/env";
import { GraderClient } from "./grader-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Free SEO & Reputation Grader",
  description:
    "Paste your website URL and get an instant, honest score: on-page SEO, mobile speed, and whether your review schema will actually show star ratings in Google. No signup required.",
  openGraph: {
    title: "Free SEO & Reputation Grader — Nodpeak",
    description:
      "Instant, honest audit of your site's SEO and review-schema eligibility. No signup.",
    type: "website",
  },
};

// Nodpeak's own top-of-funnel tool — opt-in per deployment.
// See graderEnabled() in src/lib/env.ts and the GraderLead model.
export default function GraderPage() {
  if (!graderEnabled()) notFound();
  return <GraderClient />;
}
