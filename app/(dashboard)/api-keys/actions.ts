"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Validation schemas ────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  scopes: z.array(z.enum(["read", "write", "admin"])).min(1, "Select at least one scope"),
  expiresAt: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? new Date(v) : null))
    .refine((d) => d === null || !isNaN(d!.getTime()), { message: "Invalid expiry date" }),
});

// ── Actions ───────────────────────────────────────────────────────────────────

export async function generateApiKey(formData: FormData): Promise<void> {
  const user = await requireUser();

  const raw = {
    name: String(formData.get("name") ?? ""),
    scopes: formData.getAll("scopes").map(String),
    expiresAt: String(formData.get("expiresAt") ?? ""),
  };

  const parsed = GenerateSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Validation failed.");
  }

  const { name, scopes, expiresAt } = parsed.data;

  const key = crypto.randomBytes(32).toString("hex");
  const keyPrefix = key.slice(0, 8);
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");

  await prisma.apiKey.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? null,
      userId: user.id,
      name,
      keyHash,
      keyPrefix,
      scopes,
      expiresAt: expiresAt ?? null,
    },
  });

  revalidatePath("/api-keys");
  // Pass the plaintext key once via URL so it can be displayed and then discarded
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect(("/api-keys?newKey=" + key) as any);
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await prisma.apiKey.findFirst({
    where: { id, agencyId: user.agencyId },
  });
  if (!existing || existing.revokedAt) return;

  await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/api-keys");
}
