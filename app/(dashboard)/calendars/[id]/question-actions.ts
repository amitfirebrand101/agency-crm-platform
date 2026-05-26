"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getOwnedCalendar(calendarId: string, userId: Awaited<ReturnType<typeof requireUser>>) {
  return prisma.calendar.findFirst({
    where: {
      id: calendarId,
      agencyId: userId.agencyId,
      subAccountId: userId.subAccountId ?? undefined,
    },
    select: { id: true },
  });
}

// ── Add a custom question ────────────────────────────────────────────────────

export async function addCalendarQuestion(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  if (!user.subAccountId) return { error: "No sub-account context." };

  const calendarId = z.string().uuid().parse(String(formData.get("calendarId") ?? ""));

  const calendar = await getOwnedCalendar(calendarId, user);
  if (!calendar) return { error: "Calendar not found." };

  const schema = z.object({
    label: z.string().trim().min(1).max(200),
    type: z.enum(["text", "email", "phone", "textarea", "select", "checkbox"]),
    required: z.boolean().default(false),
    options: z.string().trim().max(2000).optional(),
  });

  const parsed = schema.safeParse({
    label: formData.get("label"),
    type: formData.get("type"),
    required: formData.get("required") === "on",
    options: formData.get("options") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation error." };

  const { label, type, required, options } = parsed.data;

  const optionsArray =
    type === "select" && options
      ? options
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
      : [];

  // Determine next order value
  const maxOrder = await prisma.calendarQuestion.findFirst({
    where: { calendarId: calendar.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.calendarQuestion.create({
    data: {
      calendarId: calendar.id,
      label,
      type,
      required,
      options: optionsArray,
      order: (maxOrder?.order ?? -1) + 1,
    },
  });

  revalidatePath(`/calendars/${calendar.id}`);
  return { success: true };
}

// ── Delete a custom question ─────────────────────────────────────────────────

export async function deleteCalendarQuestion(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  if (!user.subAccountId) return { error: "No sub-account context." };

  const questionId = z.string().uuid().parse(String(formData.get("questionId") ?? ""));

  // Verify ownership via the calendar FK
  const question = await prisma.calendarQuestion.findFirst({
    where: { id: questionId },
    include: { calendar: { select: { id: true, agencyId: true, subAccountId: true } } },
  });

  if (
    !question ||
    question.calendar.agencyId !== user.agencyId ||
    question.calendar.subAccountId !== user.subAccountId
  ) {
    return { error: "Question not found." };
  }

  await prisma.calendarQuestion.delete({ where: { id: questionId } });

  revalidatePath(`/calendars/${question.calendar.id}`);
  return { success: true };
}

// ── Reorder questions (accepts JSON array of {id, order}) ────────────────────

export async function reorderCalendarQuestions(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  if (!user.subAccountId) return { error: "No sub-account context." };

  const calendarId = z.string().uuid().parse(String(formData.get("calendarId") ?? ""));

  const calendar = await getOwnedCalendar(calendarId, user);
  if (!calendar) return { error: "Calendar not found." };

  let items: Array<{ id: string; order: number }>;
  try {
    items = z
      .array(z.object({ id: z.string().uuid(), order: z.number().int().min(0) }))
      .parse(JSON.parse(String(formData.get("items") ?? "[]")));
  } catch {
    return { error: "Invalid items payload." };
  }

  await prisma.$transaction(
    items.map((item) =>
      prisma.calendarQuestion.updateMany({
        where: { id: item.id, calendarId: calendar.id },
        data: { order: item.order },
      })
    )
  );

  revalidatePath(`/calendars/${calendar.id}`);
  return { success: true };
}

// ── Update branding (logoUrl + primaryColor) ─────────────────────────────────

export async function updateCalendarBranding(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();
  if (!user.subAccountId) return { error: "No sub-account context." };

  const calendarId = z.string().uuid().parse(String(formData.get("calendarId") ?? ""));

  const calendar = await getOwnedCalendar(calendarId, user);
  if (!calendar) return { error: "Calendar not found." };

  const schema = z.object({
    logoUrl: z.string().trim().max(1000).optional(),
    primaryColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #0e7490)")
      .default("#0e7490"),
  });

  const parsed = schema.safeParse({
    logoUrl: (formData.get("logoUrl") as string | null)?.trim() || undefined,
    primaryColor: formData.get("primaryColor") || "#0e7490",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation error." };

  await prisma.calendar.update({
    where: { id: calendar.id },
    data: {
      logoUrl: parsed.data.logoUrl ?? null,
      primaryColor: parsed.data.primaryColor,
    },
  });

  revalidatePath(`/calendars/${calendar.id}`);
  return { success: true };
}
