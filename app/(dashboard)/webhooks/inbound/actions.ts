"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { generateToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export async function createInboundWebhook(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) {
    console.error("createInboundWebhook: no subAccountId on session");
    return;
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!name || name.length < 2) {
    console.error("createInboundWebhook: name is too short");
    return;
  }

  const token = generateToken(32);

  await prisma.inboundWebhook.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId,
      name,
      description,
      token,
    },
  });

  revalidatePath("/webhooks/inbound");
}

export async function deleteInboundWebhook(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) {
    console.error("deleteInboundWebhook: no subAccountId on session");
    return;
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await prisma.inboundWebhook.findFirst({
    where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  if (!existing) {
    console.error("deleteInboundWebhook: webhook not found or not owned", { id });
    return;
  }

  await prisma.inboundWebhook.delete({ where: { id } });

  revalidatePath("/webhooks/inbound");
}
