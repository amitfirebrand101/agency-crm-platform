"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Validation ────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  name: z.string().trim().min(2, "Display name must be at least 2 characters"),
  key: z
    .string()
    .trim()
    .min(2, "Key must be at least 2 characters")
    .max(50, "Key must be 50 characters or fewer")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Key must start with a lowercase letter and contain only lowercase letters, digits, and underscores"
    ),
  value: z
    .string()
    .trim()
    .min(1, "Value is required")
    .max(2000, "Value must be 2000 characters or fewer"),
});

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createCustomValue(formData: FormData): Promise<void> {
  const user = await requireUser();

  const raw = {
    name: String(formData.get("name") ?? ""),
    key: String(formData.get("key") ?? ""),
    value: String(formData.get("value") ?? ""),
  };

  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Validation failed.");
  }

  const { name, key, value } = parsed.data;
  const subAccountId = user.subAccountId ?? null;

  // Prisma nullable-field compound unique workaround: find-then-update-or-create
  const existing = await prisma.customValue.findFirst({
    where: { agencyId: user.agencyId, subAccountId, key },
  });

  if (existing) {
    await prisma.customValue.update({
      where: { id: existing.id },
      data: { name, value },
    });
  } else {
    await prisma.customValue.create({
      data: { agencyId: user.agencyId, subAccountId, name, key, value },
    });
  }

  revalidatePath("/custom-values");
}

export async function deleteCustomValue(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await prisma.customValue.findFirst({
    where: { id, agencyId: user.agencyId },
  });
  if (!existing) return;

  await prisma.customValue.delete({ where: { id } });

  revalidatePath("/custom-values");
}
