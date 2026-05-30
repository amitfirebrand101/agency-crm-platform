"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Schemas ────────────────────────────────────────────────────────────────────

const createProductSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name must be 120 characters or fewer"),
  description: z.string().trim().max(1000, "Description must be 1000 characters or fewer").optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Price must be 0 or greater").default(0),
  type: z.enum(["service", "physical", "digital"], { error: "Type must be service, physical, or digital" }),
  taxable: z.string().optional(),
});

const deleteProductSchema = z.object({
  id: z.string().uuid("Invalid product ID"),
});

// ── Actions ────────────────────────────────────────────────────────────────────

export async function createProduct(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const user = await requireUser();
  if (!user.subAccountId) return { error: "No sub-account" };

  let input: z.infer<typeof createProductSchema>;
  try {
    input = createProductSchema.parse(Object.fromEntries(formData));
  } catch (err) {
    const zodErr = err as z.ZodError;
    return { error: zodErr.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await prisma.product.create({
      data: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        name: input.name,
        description: input.description || null,
        priceCents: Math.round(input.price * 100),
        type: input.type,
        taxable: formData.get("taxable") === "on",
      },
    });
  } catch (err) {
    console.error("createProduct error", err);
    return { error: "Failed to create product. Please try again." };
  }

  revalidatePath("/products");
  return { error: null };
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (!user.subAccountId) return;

  let input: z.infer<typeof deleteProductSchema>;
  try {
    input = deleteProductSchema.parse({ id: formData.get("id") });
  } catch {
    return;
  }

  try {
    await prisma.product.findFirstOrThrow({
      where: {
        id: input.id,
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
      },
    });

    await prisma.product.delete({ where: { id: input.id } });
  } catch (err) {
    console.error("deleteProduct error", err);
    return;
  }

  revalidatePath("/products");
}
