"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Mark a single notification as read
// ─────────────────────────────────────────────────────────────────────────────

export async function markNotificationRead(formData: FormData): Promise<void> {
  const user = await requireUser();
  const notificationId = String(formData.get("notificationId") ?? "");

  if (!notificationId) return;

  try {
    await prisma.notification.findFirstOrThrow({
      where: { id: notificationId, userId: user.id },
    });

    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  } catch (err) {
    console.error("markNotificationRead failed", err);
    return;
  }

  revalidatePath("/notifications");
}

// ─────────────────────────────────────────────────────────────────────────────
// Mark all notifications as read
// ─────────────────────────────────────────────────────────────────────────────

export async function markAllRead(_formData?: FormData): Promise<void> {
  const user = await requireUser();

  try {
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        agencyId: user.agencyId,
        read: false,
      },
      data: { read: true },
    });
  } catch (err) {
    console.error("markAllRead failed", err);
    return;
  }

  revalidatePath("/notifications");
}
