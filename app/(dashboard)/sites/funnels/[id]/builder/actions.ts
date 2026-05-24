"use server";

import { revalidatePath } from "next/cache";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function savePageContent(pageId: string, funnelId: string, content: unknown) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("Access denied.");
  }
  await prisma.funnel.findFirstOrThrow({
    where: { id: funnelId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  await prisma.funnelPage.update({
    where: { id: pageId, funnelId },
    data: { content: content as never },
  });
  revalidatePath(`/sites/funnels/${funnelId}`);
}

export async function renamePage(pageId: string, funnelId: string, name: string) {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("Access denied.");
  }
  await prisma.funnel.findFirstOrThrow({
    where: { id: funnelId, agencyId: user.agencyId, subAccountId: user.subAccountId },
  });
  await prisma.funnelPage.update({
    where: { id: pageId, funnelId },
    data: { name },
  });
  revalidatePath(`/sites/funnels/${funnelId}`);
}
