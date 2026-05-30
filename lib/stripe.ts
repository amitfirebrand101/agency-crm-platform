/**
 * Stripe helper utilities.
 *
 * All functions are safe to import in server components/actions.
 * stripeConfigured() is the cheap gate-check used in the UI to render
 * "not configured" states instead of crashing.
 */

import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { decryptObject } from "@/lib/crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration checks
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true only if STRIPE_SECRET_KEY is present in the environment. */
export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Returns a configured Stripe client instance.
 * Throws if STRIPE_SECRET_KEY is not set — callers that want graceful
 * degradation should check stripeConfigured() first.
 */
export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. " +
        "Add it to your environment variables to enable Stripe."
    );
  }
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

/**
 * Returns the Stripe webhook signing secret.
 * Throws if STRIPE_WEBHOOK_SECRET is not set.
 */
export function stripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not configured. " +
        "Add it to verify Stripe webhook payloads."
    );
  }
  return secret;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connected account helpers
// ─────────────────────────────────────────────────────────────────────────────

type StripeConnectCredential = {
  stripeAccountId: string;
  accessToken: string;
  publishableKey: string;
  livemode: boolean;
};

/**
 * Finds a ProviderCredential row by agencyId + subAccountId + provider.
 *
 * Prisma's composite unique index on (agencyId, subAccountId, provider) treats
 * NULL as a distinct value, so we must pass null — not an empty string — when
 * the user has no sub-account.
 */
async function findCredential(
  agencyId: string,
  subAccountId: string | null
) {
  return prisma.providerCredential.findFirst({
    where: { agencyId, subAccountId: subAccountId ?? null, provider: "stripe_connect" },
  });
}

/**
 * Decrypts the ProviderCredential for Stripe Connect and returns the connected
 * account ID, or null if no credential is stored for this agency/sub-account.
 */
export async function getConnectedAccountId(
  agencyId: string,
  subAccountId: string | null
): Promise<string | null> {
  try {
    const cred = await findCredential(agencyId, subAccountId);
    if (!cred) return null;

    const data = decryptObject<StripeConnectCredential>({
      encryptedData: cred.encryptedData,
      iv: cred.iv,
      authTag: cred.authTag,
    });

    return data.stripeAccountId ?? null;
  } catch {
    return null;
  }
}

/**
 * Decrypts the full Stripe Connect credential object for a given
 * agency/sub-account pair. Returns null if not found or decryption fails.
 */
export async function getConnectCredential(
  agencyId: string,
  subAccountId: string | null
): Promise<StripeConnectCredential | null> {
  try {
    const cred = await findCredential(agencyId, subAccountId);
    if (!cred) return null;

    return decryptObject<StripeConnectCredential>({
      encryptedData: cred.encryptedData,
      iv: cred.iv,
      authTag: cred.authTag,
    });
  } catch {
    return null;
  }
}
