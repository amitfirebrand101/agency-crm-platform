"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createSocialPost(formData: FormData): Promise<{ error: string } | undefined> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return { error: "Authentication required." };
  }

  if (!user.subAccountId) {
    return { error: "A sub-account is required to create a social post." };
  }

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
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
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
    return { error: `Failed to create post: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath("/social");
}

export async function deleteSocialPost(formData: FormData): Promise<{ error: string } | undefined> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return { error: "Authentication required." };
  }

  if (!user.subAccountId) {
    return { error: "A sub-account is required to delete a social post." };
  }

  const idParsed = z.string().uuid("Invalid post ID.").safeParse(String(formData.get("id") ?? ""));
  if (!idParsed.success) {
    return { error: idParsed.error.issues[0]?.message ?? "Invalid post ID." };
  }

  try {
    const existing = await prisma.socialPost.findFirst({
      where: { id: idParsed.data, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });
    if (!existing) {
      return { error: "Post not found or access denied." };
    }
    await prisma.socialPost.delete({ where: { id: idParsed.data } });
  } catch (err) {
    return { error: `Failed to delete post: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath("/social");
}
