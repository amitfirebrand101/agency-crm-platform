"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function revokeApiKey(formData: FormData): Promise<void> {
  const user = await requireUser();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await prisma.apiKey.findFirst({
    where: { id, agencyId: user.agencyId },
  });
  if (!existing) {
    console.error("revokeApiKey: key not found or not owned", { id });
    return;
  }
  if (existing.revokedAt) return; // already revoked

  await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  revalidatePath(`/api-keys/${id}`);
  revalidatePath("/api-keys");
}
