import { NextRequest, NextResponse } from "next/server";
import { getStripeClient, stripeWebhookSecret, stripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

// In App Router we read the raw body via request.text() — no bodyParser config needed.

export async function POST(req: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let secret: string;
  try {
    secret = stripeWebhookSecret();
  } catch (err) {
    console.error("[stripe-webhook] Webhook secret not configured", err);
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed", err);
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    console.error("[stripe-webhook] Error handling event", { type: event.type, id: event.id, err });
    // Return 200 anyway so Stripe doesn't retry an event that errored on our end
    // (avoids exponential back-off floods from DB hiccups).
    // For business-critical events, implement an idempotent retry queue separately.
  }

  return NextResponse.json({ received: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Event handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    default:
      // Unhandled event type — not an error
      break;
  }
}

// ─── payment_intent.succeeded ───────────────────────────────────────────────

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent): Promise<void> {
  // Newer Stripe API versions expose invoice as an expandable — access via unknown cast
  const piAny = pi as unknown as Record<string, unknown>;
  const inv = piAny["invoice"];
  const invoiceId = typeof inv === "string" ? inv : (inv as { id?: string } | null)?.id ?? null;

  if (invoiceId) {
    // The payment intent came from a Stripe invoice — match by stripeInvoiceId
    await prisma.invoice.updateMany({
      where: { stripeInvoiceId: invoiceId },
      data: {
        paidAt:               new Date(),
        stripePaymentIntentId: pi.id,
        status:               "paid",
      },
    });
  } else {
    // Direct payment intent — match by stripePaymentIntentId
    await prisma.invoice.updateMany({
      where: { stripePaymentIntentId: pi.id },
      data: {
        paidAt:  new Date(),
        status:  "paid",
      },
    });
  }
}

// ─── invoice.payment_failed ──────────────────────────────────────────────────

async function handleInvoicePaymentFailed(inv: Stripe.Invoice): Promise<void> {
  const stripeInvoiceId = inv.id;
  if (!stripeInvoiceId) return;

  await prisma.invoice.updateMany({
    where: { stripeInvoiceId },
    data:  { status: "payment_failed" },
  });
}

// ─── customer.subscription.deleted ──────────────────────────────────────────

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  await prisma.stripeSubscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status:     "canceled",
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : new Date(),
    },
  });
}

// ─── customer.subscription.updated ──────────────────────────────────────────

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const firstItem = sub.items.data[0];
  const priceId   = firstItem?.price?.id ?? null;

  await prisma.stripeSubscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status:             sub.status,
      stripePriceId:      priceId,
      currentPeriodStart: typeof (sub as unknown as Record<string, unknown>)["current_period_start"] === "number"
        ? new Date(((sub as unknown as Record<string, unknown>)["current_period_start"] as number) * 1000)
        : null,
      currentPeriodEnd: typeof (sub as unknown as Record<string, unknown>)["current_period_end"] === "number"
        ? new Date(((sub as unknown as Record<string, unknown>)["current_period_end"] as number) * 1000)
        : null,
      canceledAt: sub.canceled_at != null ? new Date(sub.canceled_at * 1000) : null,
      trialEnd:   sub.trial_end   != null ? new Date(sub.trial_end   * 1000) : null,
    },
  });
}
