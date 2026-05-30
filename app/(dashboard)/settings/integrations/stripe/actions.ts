"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient, getConnectCredential, stripeConfigured } from "@/lib/stripe";

const REVALIDATE_PATH = "/settings/integrations/stripe";

// ─────────────────────────────────────────────────────────────────────────────
// Disconnect Stripe
// ─────────────────────────────────────────────────────────────────────────────

export async function disconnectStripe(_formData: FormData): Promise<void> {
  const user = await requireUser();

  try {
    await prisma.providerCredential.deleteMany({
      where: {
        agencyId:    user.agencyId,
        subAccountId: user.subAccountId ?? null,
        provider:    "stripe_connect",
      },
    });
  } catch (err) {
    console.error("[disconnectStripe] Failed to delete credential", err);
    return;
  }

  revalidatePath(REVALIDATE_PATH);
}

// ─────────────────────────────────────────────────────────────────────────────
// Create a Stripe Payment Link
// ─────────────────────────────────────────────────────────────────────────────

export async function createPaymentLink(formData: FormData): Promise<void> {
  const user = await requireUser();

  if (!stripeConfigured()) {
    console.error("[createPaymentLink] Stripe is not configured");
    return;
  }

  const name        = (formData.get("name") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim() || undefined;
  const type        = (formData.get("type") as string | null)?.trim();
  const amountRaw   = (formData.get("amountCents") as string | null)?.trim();
  const currency    = ((formData.get("currency") as string | null)?.trim() || "USD").toUpperCase();

  if (!name || name.length === 0) {
    console.error("[createPaymentLink] name is required");
    return;
  }

  if (type !== "one_time" && type !== "subscription") {
    console.error("[createPaymentLink] type must be one_time or subscription");
    return;
  }

  const amountCents = parseInt(amountRaw ?? "", 10);
  if (isNaN(amountCents) || amountCents < 50) {
    // Stripe minimum is 50 cents for most currencies
    console.error("[createPaymentLink] amountCents must be >= 50", { amountRaw });
    return;
  }

  const cred = await getConnectCredential(user.agencyId, user.subAccountId);
  if (!cred) {
    console.error("[createPaymentLink] Stripe is not connected for this account");
    return;
  }

  let stripe: ReturnType<typeof getStripeClient>;
  try {
    stripe = getStripeClient();
  } catch (err) {
    console.error("[createPaymentLink] Failed to initialise Stripe client", err);
    return;
  }

  try {
    // 1. Create a Product
    const product = await stripe.products.create(
      { name, description },
      { stripeAccount: cred.stripeAccountId }
    );

    // 2. Create a Price attached to the product
    const price = await stripe.prices.create(
      {
        product:    product.id,
        unit_amount: amountCents,
        currency:   currency.toLowerCase(),
        ...(type === "subscription"
          ? { recurring: { interval: "month" } }
          : {}),
      },
      { stripeAccount: cred.stripeAccountId }
    );

    // 3. Create a Payment Link
    const paymentLink = await stripe.paymentLinks.create(
      {
        line_items: [{ price: price.id, quantity: 1 }],
      },
      { stripeAccount: cred.stripeAccountId }
    );

    // 4. Persist to DB
    await prisma.paymentLink.create({
      data: {
        agencyId:            user.agencyId,
        subAccountId:        user.subAccountId ?? "",    // PaymentLink.subAccountId is non-nullable String
        name,
        description,
        type,
        amountCents,
        currency,
        stripeProductId:     product.id,
        stripePriceId:       price.id,
        stripePaymentLinkId: paymentLink.id,
        stripePaymentLinkUrl: paymentLink.url,
        active:              true,
      },
    });
  } catch (err) {
    console.error("[createPaymentLink] Stripe API or DB error", err);
    return;
  }

  revalidatePath(REVALIDATE_PATH);
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a Payment Link
// ─────────────────────────────────────────────────────────────────────────────

export async function deletePaymentLink(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id   = (formData.get("id") as string | null)?.trim();

  if (!id) {
    console.error("[deletePaymentLink] id is required");
    return;
  }

  // Verify ownership before deletion
  const link = await prisma.paymentLink.findUnique({ where: { id } });

  if (
    !link ||
    link.agencyId !== user.agencyId ||
    // PaymentLink.subAccountId is non-nullable String — fallback to "" matches the create path
    link.subAccountId !== (user.subAccountId ?? "")
  ) {
    console.error("[deletePaymentLink] Payment link not found or access denied", { id });
    return;
  }

  try {
    await prisma.paymentLink.delete({ where: { id } });
  } catch (err) {
    console.error("[deletePaymentLink] Failed to delete payment link", err);
    return;
  }

  revalidatePath(REVALIDATE_PATH);
}
