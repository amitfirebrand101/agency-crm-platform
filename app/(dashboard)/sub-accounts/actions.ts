"use server";

import { revalidatePath } from "next/cache";
import { canWriteAgency, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import { subAccountSchema } from "@/lib/validation";

export async function createSubAccount(formData: FormData) {
  const user = await requireUser();

  if (!canWriteAgency(user.agencyRole)) {
    throw new Error("You do not have permission to create sub accounts.");
  }

  const input = subAccountSchema.parse(Object.fromEntries(formData));
  const subAccount = await prisma.subAccount.create({
    data: {
      agencyId: user.agencyId,
      name: input.name,
      slug: input.slug,
      city: input.city || null,
      region: input.region || null,
      members: {
        create: {
          userId: user.id,
          role: "ADMIN"
        }
      }
    }
  });

  await auditLog({
    agencyId: user.agencyId,
    actorUserId: user.id,
    action: "CREATE",
    entityType: "SubAccount",
    entityId: subAccount.id
  });

  revalidatePath("/sub-accounts");
  revalidatePath("/dashboard");
}
