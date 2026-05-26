"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";

const smartListFiltersSchema = z.object({
  status: z.enum(["LEAD", "CUSTOMER", "INACTIVE"]).optional(),
  source: z.string().trim().max(80).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
  scoreMin: z.number().int().min(0).max(100).optional(),
  scoreMax: z.number().int().min(0).max(100).optional(),
  assignedUserId: z.string().uuid().optional(),
  emailOptOut: z.boolean().optional(),
  smsOptOut: z.boolean().optional(),
});

export type SmartListFilters = z.infer<typeof smartListFiltersSchema>;

const saveSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  filters: smartListFiltersSchema,
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

async function requireAccess() {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("Permission denied.");
  }
  return user as typeof user & { subAccountId: string };
}

export async function saveSmartList(formData: FormData): Promise<{ error: string | null; id?: string }> {
  try {
    const user = await requireAccess();
    const name = String(formData.get("name") ?? "");
    const rawFilters = String(formData.get("filters") ?? "{}");

    let parsedFilters: unknown;
    try {
      parsedFilters = JSON.parse(rawFilters);
    } catch {
      return { error: "Invalid filter data." };
    }

    const validated = saveSchema.parse({ name, filters: parsedFilters });

    const list = await prisma.smartList.create({
      data: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        name: validated.name,
        filters: validated.filters as object,
      },
    });

    await auditLog({
      agencyId: user.agencyId,
      actorUserId: user.id,
      action: "CREATE",
      entityType: "SmartList",
      entityId: list.id,
    });

    revalidatePath("/contacts");
    return { error: null, id: list.id };
  } catch (err) {
    const zodErr = err as z.ZodError;
    if (zodErr?.issues) return { error: zodErr.issues[0]?.message ?? "Invalid input." };
    return { error: String(err instanceof Error ? err.message : err) };
  }
}

export async function deleteSmartList(formData: FormData): Promise<{ error: string | null }> {
  try {
    const user = await requireAccess();
    const id = deleteSchema.parse({ id: String(formData.get("id") ?? "") }).id;

    await prisma.smartList.deleteMany({
      where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });

    await auditLog({
      agencyId: user.agencyId,
      actorUserId: user.id,
      action: "DELETE",
      entityType: "SmartList",
      entityId: id,
    });

    revalidatePath("/contacts");
    return { error: null };
  } catch (err) {
    const zodErr = err as z.ZodError;
    if (zodErr?.issues) return { error: zodErr.issues[0]?.message ?? "Invalid input." };
    return { error: String(err instanceof Error ? err.message : err) };
  }
}

export async function listSmartLists(): Promise<{
  lists: Array<{ id: string; name: string; filters: SmartListFilters }>;
  error: string | null;
}> {
  try {
    const user = await requireUser();
    if (!user.subAccountId) return { lists: [], error: null };

    const lists = await prisma.smartList.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, filters: true },
    });

    return {
      lists: lists.map((l) => ({
        id: l.id,
        name: l.name,
        filters: (l.filters as SmartListFilters) ?? {},
      })),
      error: null,
    };
  } catch (err) {
    return { lists: [], error: String(err instanceof Error ? err.message : err) };
  }
}
