"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Schemas ────────────────────────────────────────────────────────────────────

const createInvoiceSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  number: z.string().trim().min(1, "Invoice number is required"),
  contactId: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or fewer").optional(),
});

const updateInvoiceStatusSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"], {
    error: "Status must be draft, sent, paid, overdue, or cancelled",
  }),
});

const deleteInvoiceSchema = z.object({
  id: z.string().uuid("Invalid invoice ID"),
});

// ── Actions ────────────────────────────────────────────────────────────────────

export async function createInvoice(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (!user.subAccountId) return { error: "No sub-account" };

  let raw: z.infer<typeof createInvoiceSchema>;
  try {
    raw = createInvoiceSchema.parse(Object.fromEntries(formData));
  } catch (err) {
    const zodErr = err as z.ZodError;
    return { error: zodErr.issues[0]?.message ?? "Invalid input." };
  }

  // Resolve contactId — must be a UUID or null
  let contactId: string | null = null;
  if (raw.contactId && raw.contactId.trim() !== "") {
    const uuidResult = z.string().uuid().safeParse(raw.contactId);
    if (!uuidResult.success) return { error: "Invalid contact selection." };
    contactId = uuidResult.data;
  }

  // Resolve dueDate
  let dueDate: Date | null = null;
  if (raw.dueDate && raw.dueDate.trim() !== "") {
    const d = new Date(raw.dueDate);
    if (isNaN(d.getTime())) return { error: "Invalid due date." };
    dueDate = d;
  }

  try {
    await prisma.invoice.create({
      data: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        title: raw.title,
        number: raw.number,
        contactId,
        status: "draft",
        dueDate,
        notes: raw.notes || null,
        subtotalCents: 0,
        taxCents: 0,
        discountCents: 0,
        totalCents: 0,
        paidCents: 0,
      },
    });
  } catch (err) {
    console.error("createInvoice error", err);
    return { error: "Failed to create invoice. Please try again." };
  }

  revalidatePath("/invoices");
  return { error: null };
}

export async function updateInvoiceStatus(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  let input: z.infer<typeof updateInvoiceStatusSchema>;
  try {
    input = updateInvoiceStatusSchema.parse({
      invoiceId: formData.get("invoiceId"),
      status: formData.get("status"),
    });
  } catch (err) {
    console.error("updateInvoiceStatus validation error", err);
    return;
  }

  try {
    await prisma.invoice.findFirstOrThrow({
      where: {
        id: input.invoiceId,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
    });

    await prisma.invoice.update({
      where: { id: input.invoiceId },
      data: {
        status: input.status,
        ...(input.status === "paid" ? { paidAt: new Date() } : {}),
      },
    });
  } catch (err) {
    console.error("updateInvoiceStatus error", err);
    return;
  }

  revalidatePath("/invoices");
}

export async function deleteInvoice(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  let input: z.infer<typeof deleteInvoiceSchema>;
  try {
    input = deleteInvoiceSchema.parse({ id: formData.get("id") });
  } catch {
    return;
  }

  try {
    await prisma.invoice.findFirstOrThrow({
      where: {
        id: input.id,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
    });

    await prisma.invoice.delete({ where: { id: input.id } });
  } catch (err) {
    console.error("deleteInvoice error", err);
    return;
  }

  revalidatePath("/invoices");
}
