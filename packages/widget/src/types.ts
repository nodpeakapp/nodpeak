export type TestimonialReview = {
  rating: number;
  customerName: string | null;
  comment: string | null;
  createdAt: string;
};

export type SiteConfig = {
  announcementEnabled: boolean;
  announcementText: string;
  announcementLinkUrl: string | null;
  announcementLinkText: string | null;
  announcementBg: string;
  announcementFg: string;

  whatsappEnabled: boolean;
  whatsappNumber: string | null;
  whatsappMessage: string;

  emailCaptureEnabled: boolean;
  emailCaptureTitle: string;
  emailCaptureSubtitle: string;
  emailCaptureDelayMs: number;

  trustBarEnabled: boolean;
  trustBarItems: Array<{ icon: string; label: string }>;

  contactFormEnabled: boolean;
  contactFormTitle: string;
};

export type WidgetConfig = {
  projectId: string;
  projectName: string;
  domain: string;
  primaryColor: string;
  accentColor: string;
  title: string;
  subtitle: string;
  promptQuestion: string;
  minStarForExternal: number;
  showSeoBadge: boolean;
  placement: "bubble" | "inline";
  googleReviewUrl: string | null;
  trustpilotReviewUrl: string | null;
  aggregate: { count: number; average: number } | null;
  /** Pre-serialized JSON-LD from the server; null when there is nothing to claim. */
  jsonLd: string | null;
  publicReviews: TestimonialReview[];
  wall: TestimonialReview[];
  site: SiteConfig;
};

export type LeadResponse = { ok: boolean; leadId?: string; error?: string };
export type SubscribeResponse = { ok: boolean; error?: string };

export type FeedbackResponse = {
  ok: boolean;
  reviewId?: string;
  sentiment?: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  redirect?: { google: string | null; trustpilot: string | null } | null;
  error?: string;
};
