"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function toggleWebhookEnabled(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) {
    console.error("toggleWebhookEnabled: no subAccountId on session");
    return;
  }

  const id = String(formData.get("id") ?? "").trim();
  const enabledStr = String(formData.get("enabled") ?? "");
  if (!id) return;

  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  if (!existing) {
    console.error("toggleWebhookEnabled: endpoint not found or not owned", { id });
    return;
  }

  const enabled = enabledStr === "true";
  await prisma.webhookEndpoint.update({ where: { id }, data: { enabled } });

  revalidatePath(`/webhooks/${id}`);
  revalidatePath("/webhooks");
}

export async function deleteDeliveryLog(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) {
    console.error("deleteDeliveryLog: no subAccountId on session");
    return;
  }

  const logId = String(formData.get("logId") ?? "").trim();
  const endpointId = String(formData.get("endpointId") ?? "").trim();
  if (!logId || !endpointId) return;

  // Verify the endpoint belongs to this user's agency+sub-account before deleting
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  if (!endpoint) {
    console.error("deleteDeliveryLog: endpoint not owned", { endpointId });
    return;
  }

  await prisma.webhookDeliveryLog.deleteMany({
    where: { id: logId, webhookEndpointId: endpointId },
  });

  revalidatePath(`/webhooks/${endpointId}`);
}
