"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireSubAccountWrite() {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage canned responses.");
  }
  return user;
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  body: z.string().min(1, "Body is required"),
});

export async function createCannedResponse(formData: FormData) {
  const user = await requireSubAccountWrite();
  const result = createSchema.safeParse({
    name: formData.get("name"),
    body: formData.get("body"),
  });
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid input");
  }

  await prisma.cannedResponse.create({
    data: {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId!,
      name: result.data.name,
      body: result.data.body,
    },
  });

  revalidatePath("/conversations/canned-responses");
}

export async function deleteCannedResponse(formData: FormData) {
  const user = await requireSubAccountWrite();
  const id = z.string().uuid().parse(String(formData.get("id") ?? ""));

  await prisma.cannedResponse.deleteMany({
    where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId! },
  });

  revalidatePath("/conversations/canned-responses");
}
