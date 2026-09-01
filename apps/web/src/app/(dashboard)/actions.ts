"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireProject } from "@/lib/auth";
import { limitsFor, isLeadStatus } from "@/lib/enums";
import { invalidate } from "@/lib/response-cache";

export type ActionState = { error: string | null; ok?: boolean };

const domainSchema = z
  .string()
  .trim()
  .min(3)
  .max(253)
  .transform((v) => v.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "").toLowerCase())
  .refine((v) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v), "Enter a domain like acmeplumbing.com");

/* ── projects ─────────────────────────────────────────────── */

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = z
    .object({
      name: z.string().trim().min(1, "Give the project a name").max(120),
      domain: domainSchema,
    })
    .safeParse({ name: formData.get("name"), domain: formData.get("domain") });

  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const limits = limitsFor(user.plan);
  const count = await prisma.project.count({ where: { userId: user.id } });
  if (count >= limits.projects) {
    return {
      error: `Your plan allows ${limits.projects} project${limits.projects === 1 ? "" : "s"}.`,
    };
  }

  await prisma.project.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      domain: parsed.data.domain,
      // Every project gets a widget config up front, so the widget endpoint
      // never has to invent defaults for a half-created project.
      widgetConfig: { create: {} },
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/widgets");
  return { error: null, ok: true };
}

export async function updateProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");

  const parsed = z
    .object({
      name: z.string().trim().min(1, "Give the project a name").max(120),
      domain: domainSchema,
      googlePlaceId: z.string().trim().max(200).nullish(),
      trustpilotSlug: z.string().trim().max(200).nullish(),
      webhookUrl: z
        .string()
        .trim()
        .url("Webhook must be a full https:// URL")
        .max(2000)
        .nullish()
        .or(z.literal("").transform(() => null)),
    })
    .safeParse({
      name: formData.get("name"),
      domain: formData.get("domain"),
      googlePlaceId: formData.get("googlePlaceId") || null,
      trustpilotSlug: formData.get("trustpilotSlug") || null,
      webhookUrl: formData.get("webhookUrl") || null,
    });

  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  try {
    await requireProject(projectId, user.id);
  } catch {
    return { error: "Project not found" };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name: parsed.data.name,
      domain: parsed.data.domain,
      googlePlaceId: parsed.data.googlePlaceId || null,
      trustpilotSlug: parsed.data.trustpilotSlug || null,
      webhookUrl: parsed.data.webhookUrl || null,
    },
  });

  invalidate(`widget-config:${projectId}`);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true, domain: true },
  });
  if (!project) return;
  // Typing the domain is the guard. Reviews are not recoverable.
  if (confirm.trim().toLowerCase() !== project.domain.toLowerCase()) return;

  await prisma.project.delete({ where: { id: project.id } });
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

/* ── widget config ────────────────────────────────────────── */

export async function updateWidgetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");

  const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Colours must be 6-digit hex, like #f59e0b");

  const parsed = z
    .object({
      primaryColor: hex,
      accentColor: hex,
      title: z.string().trim().min(1).max(120),
      subtitle: z.string().trim().max(200),
      promptQuestion: z.string().trim().max(200),
      minStarForExternal: z.coerce.number().int().min(1).max(5),
      showSeoBadge: z.coerce.boolean(),
      placement: z.enum(["bubble", "inline"]),
    })
    .safeParse({
      primaryColor: formData.get("primaryColor"),
      accentColor: formData.get("accentColor"),
      title: formData.get("title"),
      subtitle: formData.get("subtitle") ?? "",
      promptQuestion: formData.get("promptQuestion") ?? "",
      minStarForExternal: formData.get("minStarForExternal"),
      showSeoBadge: formData.get("showSeoBadge") === "on",
      placement: formData.get("placement"),
    });

  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  try {
    await requireProject(projectId, user.id);
  } catch {
    return { error: "Project not found" };
  }

  await prisma.widgetConfig.upsert({
    where: { projectId },
    create: { projectId, ...parsed.data },
    update: parsed.data,
  });

  invalidate(`widget-config:${projectId}`);
  revalidatePath("/widgets");
  return { error: null, ok: true };
}

/* ── site widget config (announcement / whatsapp / email capture / trust bar / contact form) ── */

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Colours must be 6-digit hex, like #25d6e8");

export async function updateSiteConfigAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");

  const trustItems = String(formData.get("trustBarItems") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((label) => ({ icon: "check", label: label.slice(0, 60) }));

  const parsed = z
    .object({
      announcementEnabled: z.coerce.boolean(),
      announcementText: z.string().trim().max(200),
      announcementLinkUrl: z.string().trim().url().max(2000).nullish().or(z.literal("").transform(() => null)),
      announcementLinkText: z.string().trim().max(40).nullish(),
      announcementBg: hexColor,
      announcementFg: hexColor,

      whatsappEnabled: z.coerce.boolean(),
      whatsappNumber: z
        .string()
        .trim()
        .max(20)
        .nullish()
        .transform((v) => (v ? v.replace(/[^\d+]/g, "") : null)),
      whatsappMessage: z.string().trim().max(300),

      emailCaptureEnabled: z.coerce.boolean(),
      emailCaptureTitle: z.string().trim().max(120),
      emailCaptureSubtitle: z.string().trim().max(200),
      emailCaptureDelayMs: z.coerce.number().int().min(0).max(60_000),

      trustBarEnabled: z.coerce.boolean(),

      contactFormEnabled: z.coerce.boolean(),
      contactFormTitle: z.string().trim().max(120),
    })
    .safeParse({
      announcementEnabled: formData.get("announcementEnabled") === "on",
      announcementText: formData.get("announcementText") ?? "",
      announcementLinkUrl: formData.get("announcementLinkUrl") || null,
      announcementLinkText: formData.get("announcementLinkText") || null,
      announcementBg: formData.get("announcementBg"),
      announcementFg: formData.get("announcementFg"),

      whatsappEnabled: formData.get("whatsappEnabled") === "on",
      whatsappNumber: formData.get("whatsappNumber") || null,
      whatsappMessage: formData.get("whatsappMessage") ?? "",

      emailCaptureEnabled: formData.get("emailCaptureEnabled") === "on",
      emailCaptureTitle: formData.get("emailCaptureTitle") ?? "",
      emailCaptureSubtitle: formData.get("emailCaptureSubtitle") ?? "",
      emailCaptureDelayMs: formData.get("emailCaptureDelayMs") || "4000",

      trustBarEnabled: formData.get("trustBarEnabled") === "on",

      contactFormEnabled: formData.get("contactFormEnabled") === "on",
      contactFormTitle: formData.get("contactFormTitle") ?? "",
    });

  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  try {
    await requireProject(projectId, user.id);
  } catch {
    return { error: "Project not found" };
  }

  const data = { ...parsed.data, trustBarItemsJson: JSON.stringify(trustItems) };

  await prisma.siteWidgetConfig.upsert({
    where: { projectId },
    create: { projectId, ...data },
    update: data,
  });

  invalidate(`widget-config:${projectId}`);
  revalidatePath("/growth");
  return { error: null, ok: true };
}

/* ── uptime monitor ───────────────────────────────────────── */

export async function updateUptimeMonitorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");

  const parsed = z
    .object({
      enabled: z.coerce.boolean(),
      url: z
        .string()
        .trim()
        .url("Enter a full https:// URL to monitor")
        .max(2000)
        .nullish()
        .or(z.literal("").transform(() => null)),
      notifyEmail: z.string().trim().email().max(200).nullish().or(z.literal("").transform(() => null)),
      intervalMinutes: z.coerce.number().int().min(1).max(60),
    })
    .safeParse({
      enabled: formData.get("enabled") === "on",
      url: formData.get("url") || null,
      notifyEmail: formData.get("notifyEmail") || null,
      intervalMinutes: formData.get("intervalMinutes") || "5",
    });

  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const { enabled, url, notifyEmail, intervalMinutes } = parsed.data;
  if (enabled && !url) return { error: "Add a URL to monitor before turning this on" };

  try {
    await requireProject(projectId, user.id);
  } catch {
    return { error: "Project not found" };
  }

  await prisma.uptimeMonitor.upsert({
    where: { projectId },
    create: { projectId, enabled, url, notifyEmail, intervalMinutes },
    update: { enabled, url, notifyEmail, intervalMinutes },
  });

  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

/* ── leads & subscribers ──────────────────────────────────── */

export async function updateLeadStatusAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const leadId = String(formData.get("leadId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isLeadStatus(status)) return;

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, project: { userId: user.id } },
    select: { id: true },
  });
  if (!lead) return;

  await prisma.lead.update({ where: { id: lead.id }, data: { status } });
  revalidatePath("/leads");
}

export async function deleteLeadAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const leadId = String(formData.get("leadId") ?? "");

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, project: { userId: user.id } },
    select: { id: true },
  });
  if (!lead) return;

  await prisma.lead.delete({ where: { id: lead.id } });
  revalidatePath("/leads");
}

/* ── review moderation ────────────────────────────────────── */

export async function toggleReviewPublicAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const reviewId = String(formData.get("reviewId") ?? "");

  const review = await prisma.review.findFirst({
    where: { id: reviewId, project: { userId: user.id } },
    select: { id: true, isPublic: true, projectId: true },
  });
  if (!review) return;

  await prisma.review.update({
    where: { id: review.id },
    data: { isPublic: !review.isPublic },
  });

  // The widget's cached payload embeds the public wall and the JSON-LD, so
  // approving a review has to drop it or the change is invisible for a minute.
  invalidate(`widget-config:${review.projectId}`);
  revalidatePath("/reviews");
  revalidatePath("/dashboard");
}

export async function toggleReviewFeaturedAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const reviewId = String(formData.get("reviewId") ?? "");

  const review = await prisma.review.findFirst({
    where: { id: reviewId, project: { userId: user.id } },
    select: { id: true, featuredForWall: true, projectId: true },
  });
  if (!review) return;

  await prisma.review.update({
    where: { id: review.id },
    data: { featuredForWall: !review.featuredForWall },
  });

  invalidate(`widget-config:${review.projectId}`);
  revalidatePath("/reviews");
}

export async function deleteReviewAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const reviewId = String(formData.get("reviewId") ?? "");

  const review = await prisma.review.findFirst({
    where: { id: reviewId, project: { userId: user.id } },
    select: { id: true, projectId: true },
  });
  if (!review) return;

  await prisma.review.delete({ where: { id: review.id } });
  invalidate(`widget-config:${review.projectId}`);
  revalidatePath("/reviews");
  revalidatePath("/dashboard");
}
