"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createSocialPost(formData: FormData): Promise<void> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    console.error("createSocialPost: authentication failed");
    return;
  }

  if (!user.subAccountId) return;

  const rawPlatforms = formData.getAll("platforms").map((p) => String(p));
  const rawScheduledAt = String(formData.get("scheduledAt") ?? "").trim();

  const schema = z.object({
    content: z.string().trim().min(5, "Content must be at least 5 characters.").max(5000),
    platforms: z.array(z.string()).min(1, "Select at least one platform."),
    scheduledAt: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : null))
      .refine((v) => v === null || !isNaN(v!.getTime()), { message: "Invalid scheduled date." }),
  });

  const parsed = schema.safeParse({
    content: formData.get("content"),
    platforms: rawPlatforms,
    scheduledAt: rawScheduledAt || undefined,
  });

  if (!parsed.success) {
    console.error("createSocialPost: validation failed", parsed.error.issues[0]?.message);
    return;
  }

  const { content, platforms, scheduledAt } = parsed.data;

  try {
    await prisma.socialPost.create({
      data: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        content,
        platforms,
        status: scheduledAt ? "scheduled" : "draft",
        scheduledAt: scheduledAt ?? null,
      },
    });
  } catch (err) {
    console.error("createSocialPost: failed", err);
    return;
  }

  revalidatePath("/social");
}

export async function deleteSocialPost(formData: FormData): Promise<void> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    console.error("deleteSocialPost: authentication failed");
    return;
  }

  if (!user.subAccountId) return;

  const idParsed = z.string().uuid().safeParse(String(formData.get("id") ?? ""));
  if (!idParsed.success) return;

  try {
    const existing = await prisma.socialPost.findFirst({
      where: { id: idParsed.data, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });
    if (!existing) return;
    await prisma.socialPost.delete({ where: { id: idParsed.data } });
  } catch (err) {
    console.error("deleteSocialPost: failed", err);
    return;
  }

  revalidatePath("/social");
}
