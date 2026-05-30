"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── SSRF protection ───────────────────────────────────────────────────────────

function isPrivateUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1)/.test(hostname);
  } catch {
    return true;
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

const ALLOWED_EVENTS = [
  "contact.created",
  "contact.updated",
  "conversation.message",
  "appointment.created",
  "opportunity.created",
  "opportunity.status_changed",
  "form.submitted",
] as const;

const CreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  url: z
    .string()
    .url("Enter a valid URL")
    .refine((u) => u.startsWith("https://"), { message: "URL must start with https://" }),
  events: z
    .array(z.enum(ALLOWED_EVENTS))
    .min(1, "Select at least one event"),
});

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createWebhookEndpoint(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) throw new Error("No sub-account context.");

  const raw = {
    name: String(formData.get("name") ?? ""),
    url: String(formData.get("url") ?? ""),
    events: formData.getAll("events").map(String),
  };

  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Validation failed.");
  }

  const { name, url, events } = parsed.data;

  if (isPrivateUrl(url)) {
    throw new Error("URL points to a private or reserved IP range. Use a public HTTPS endpoint.");
  }

  const secret = crypto.randomBytes(32).toString("hex");

  await prisma.webhookEndpoint.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name,
      url,
      events,
      secret,
    },
  });

  revalidatePath("/webhooks");
}

export async function deleteWebhookEndpoint(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) throw new Error("No sub-account context.");

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  if (!existing) return;

  await prisma.webhookEndpoint.delete({ where: { id } });

  revalidatePath("/webhooks");
}

export async function toggleWebhookEndpoint(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) throw new Error("No sub-account context.");

  const id = String(formData.get("id") ?? "").trim();
  const enabledStr = String(formData.get("enabled") ?? "");
  if (!id) return;

  const enabled = enabledStr === "true";

  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  if (!existing) return;

  await prisma.webhookEndpoint.update({ where: { id }, data: { enabled } });

  revalidatePath("/webhooks");
}
