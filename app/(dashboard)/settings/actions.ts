"use server";

import { revalidatePath } from "next/cache";
import { canWriteAgency, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { agencySchema } from "@/lib/validation";

export async function updateAgency(formData: FormData) {
  const user = await requireUser();

  if (!canWriteAgency(user.agencyRole)) {
    throw new Error("Only agency owners and admins can update agency settings.");
  }

  const input = agencySchema.parse(Object.fromEntries(formData));

  await prisma.agency.update({
    where: { id: user.agencyId },
    data: {
      name: input.name,
      timezone: input.timezone || undefined,
      currency: input.currency?.toUpperCase() || undefined,
      country: input.country?.toUpperCase() || undefined
    }
  });

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "UPDATE",
    entityType: "Agency",
    entityId: user.agencyId
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
