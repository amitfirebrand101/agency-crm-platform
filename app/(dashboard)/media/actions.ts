"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Validation ────────────────────────────────────────────────────────────────

const AddSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  url: z.string().url("Enter a valid URL"),
  mimeType: z.string().trim().min(1).default("application/octet-stream"),
  altText: z.string().trim().optional(),
  folder: z.string().trim().optional(),
});

// ── Actions ───────────────────────────────────────────────────────────────────

export async function addMediaFile(formData: FormData): Promise<void> {
  const user = await requireUser();

  const rawMimeType = String(formData.get("mimeType") ?? "").trim();

  const raw = {
    name: String(formData.get("name") ?? ""),
    url: String(formData.get("url") ?? ""),
    mimeType: rawMimeType || "application/octet-stream",
    altText: String(formData.get("altText") ?? "") || undefined,
    folder: String(formData.get("folder") ?? "") || undefined,
  };

  const parsed = AddSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Validation failed.");
  }

  const { name, url, mimeType, altText, folder } = parsed.data;

  await prisma.mediaFile.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? null,
      name,
      url,
      mimeType,
      sizeBytes: BigInt(0),
      altText: altText ?? null,
      folder: folder ?? null,
    },
  });

  revalidatePath("/media");
}

export async function deleteMediaFile(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await prisma.mediaFile.findFirst({
    where: { id, agencyId: user.agencyId },
  });
  if (!existing) return;

  await prisma.mediaFile.delete({ where: { id } });

  revalidatePath("/media");
}
