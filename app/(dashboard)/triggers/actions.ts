"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SLUG_REGEX = /^[a-z0-9-]+$/;

export async function createTriggerLink(formData: FormData): Promise<{ error: string } | undefined> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return { error: "Authentication required." };
  }

  if (!user.subAccountId) {
    return { error: "A sub-account is required to create a trigger link." };
  }

  const schema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters.").max(200),
    slug: z
      .string()
      .trim()
      .min(1, "Slug is required.")
      .max(100)
      .regex(SLUG_REGEX, "Slug may only contain lowercase letters, numbers, and hyphens."),
    redirectUrl: z
      .string()
      .trim()
      .min(1, "Redirect URL is required.")
      .refine(
        (v) => /^https?:\/\/.+/.test(v),
        "Redirect URL must start with http:// or https://."
      ),
  });

  const parsed = schema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    redirectUrl: formData.get("redirectUrl"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, slug, redirectUrl } = parsed.data;

  try {
    const existing = await prisma.triggerLink.findFirst({
      where: { subAccountId: user.subAccountId, slug },
    });
    if (existing) {
      return { error: `The slug "/${slug}" is already in use. Choose a different one.` };
    }

    await prisma.triggerLink.create({
      data: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        name,
        slug,
        redirectUrl,
      },
    });
  } catch (err) {
    return { error: `Failed to create trigger link: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath("/triggers");
}

export async function deleteTriggerLink(formData: FormData): Promise<{ error: string } | undefined> {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return { error: "Authentication required." };
  }

  if (!user.subAccountId) {
    return { error: "A sub-account is required to delete a trigger link." };
  }

  const idParsed = z.string().uuid("Invalid trigger link ID.").safeParse(String(formData.get("id") ?? ""));
  if (!idParsed.success) {
    return { error: idParsed.error.issues[0]?.message ?? "Invalid trigger link ID." };
  }

  try {
    const existing = await prisma.triggerLink.findFirst({
      where: { id: idParsed.data, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });
    if (!existing) {
      return { error: "Trigger link not found or access denied." };
    }
    await prisma.triggerLink.delete({ where: { id: idParsed.data } });
  } catch (err) {
    return { error: `Failed to delete trigger link: ${err instanceof Error ? err.message : String(err)}` };
  }

  revalidatePath("/triggers");
}
