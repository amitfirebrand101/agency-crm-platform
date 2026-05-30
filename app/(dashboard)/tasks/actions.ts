"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Schemas ────────────────────────────────────────────────────────────────────

const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters.")
    .max(200, "Title must be 200 characters or fewer."),
  contactId: z.string().uuid("Invalid contact."),
  assignedUserId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : undefined))
    .pipe(z.string().uuid("Invalid assigned user.").optional()),
  dueDate: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : undefined)),
});

const taskIdSchema = z.object({
  taskId: z.string().uuid("Invalid task ID."),
});

// ── Helpers ────────────────────────────────────────────────────────────────────

async function requireWritableSubAccount() {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage tasks.");
  }
  return user as typeof user & { subAccountId: string };
}

// ── Actions ────────────────────────────────────────────────────────────────────

export async function createTask(formData: FormData): Promise<void> {
  let user: Awaited<ReturnType<typeof requireWritableSubAccount>>;
  try {
    user = await requireWritableSubAccount();
  } catch {
    return;
  }

  let input: z.infer<typeof createTaskSchema>;
  try {
    input = createTaskSchema.parse(Object.fromEntries(formData));
  } catch (err) {
    console.error("createTask validation failed", err);
    return;
  }

  try {
    await prisma.contact.findFirstOrThrow({
      where: {
        id: input.contactId,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
    });

    let dueDateValue: Date | null = null;
    if (input.dueDate) {
      const parsed = new Date(input.dueDate);
      if (!isNaN(parsed.getTime())) {
        dueDateValue = parsed;
      }
    }

    await prisma.contactTask.create({
      data: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        contactId: input.contactId,
        assignedUserId: input.assignedUserId ?? null,
        title: input.title,
        dueDate: dueDateValue,
      },
    });

    revalidatePath("/tasks");
  } catch (err) {
    console.error("createTask failed", err);
  }
}

export async function completeTask(formData: FormData): Promise<void> {
  let user: Awaited<ReturnType<typeof requireWritableSubAccount>>;
  try {
    user = await requireWritableSubAccount();
  } catch {
    return;
  }

  let input: z.infer<typeof taskIdSchema>;
  try {
    input = taskIdSchema.parse(Object.fromEntries(formData));
  } catch {
    return;
  }

  try {
    await prisma.contactTask.findFirstOrThrow({
      where: { id: input.taskId, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });
    await prisma.contactTask.update({
      where: { id: input.taskId },
      data: { completedAt: new Date() },
    });
    revalidatePath("/tasks");
  } catch (err) {
    console.error("completeTask failed", err);
  }
}

export async function uncompleteTask(formData: FormData): Promise<void> {
  let user: Awaited<ReturnType<typeof requireWritableSubAccount>>;
  try {
    user = await requireWritableSubAccount();
  } catch {
    return;
  }

  let input: z.infer<typeof taskIdSchema>;
  try {
    input = taskIdSchema.parse(Object.fromEntries(formData));
  } catch {
    return;
  }

  try {
    await prisma.contactTask.findFirstOrThrow({
      where: { id: input.taskId, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });
    await prisma.contactTask.update({
      where: { id: input.taskId },
      data: { completedAt: null },
    });
    revalidatePath("/tasks");
  } catch (err) {
    console.error("uncompleteTask failed", err);
  }
}

export async function deleteTask(formData: FormData): Promise<void> {
  let user: Awaited<ReturnType<typeof requireWritableSubAccount>>;
  try {
    user = await requireWritableSubAccount();
  } catch {
    return;
  }

  let input: z.infer<typeof taskIdSchema>;
  try {
    input = taskIdSchema.parse(Object.fromEntries(formData));
  } catch {
    return;
  }

  try {
    await prisma.contactTask.findFirstOrThrow({
      where: { id: input.taskId, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });
    await prisma.contactTask.delete({ where: { id: input.taskId } });
    revalidatePath("/tasks");
  } catch (err) {
    console.error("deleteTask failed", err);
  }
}
