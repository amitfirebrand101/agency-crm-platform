"use server";

import { revalidatePath } from "next/cache";
import { canWriteSubAccount, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/security";
import {
  twilioConfigured,
  searchNumbers as twilioSearchNumbers,
  purchaseNumber,
  releaseNumber,
} from "@/lib/twilio";

// ─────────────────────────────────────────────────────────────────────────────
// Access guard
// ─────────────────────────────────────────────────────────────────────────────

async function requireWritableSmsAccess() {
  const user = await requireUser();
  if (!user.subAccountId || !canWriteSubAccount(user.subAccountRole)) {
    throw new Error("You do not have permission to manage phone numbers.");
  }
  return user as typeof user & { subAccountId: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Search available Twilio numbers
// ─────────────────────────────────────────────────────────────────────────────

export type NumberSearchResult = {
  number: string;
  locality: string;
  region: string;
  capabilities: { sms: boolean; voice: boolean; mms: boolean };
};

export async function searchTwilioNumbers(
  formData: FormData
): Promise<{ numbers: NumberSearchResult[] } | { error: string }> {
  try {
    await requireWritableSmsAccess();

    if (!twilioConfigured()) {
      return { error: "Twilio is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to your environment." };
    }

    const areaCode = String(formData.get("areaCode") ?? "").trim();
    if (!areaCode || !/^\d{3}$/.test(areaCode)) {
      return { error: "Please enter a valid 3-digit area code." };
    }

    const smsEnabled = formData.get("smsEnabled") !== "false";
    const voiceEnabled = formData.get("voiceEnabled") !== "false";

    const numbers = await twilioSearchNumbers(areaCode, smsEnabled, voiceEnabled);
    return { numbers };
  } catch (err) {
    console.error("[sms/actions] searchTwilioNumbers failed:", err);
    return { error: err instanceof Error ? err.message : "Failed to search numbers." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provision (purchase) a Twilio number
// ─────────────────────────────────────────────────────────────────────────────

export async function provisionTwilioNumber(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireWritableSmsAccess();

    if (!twilioConfigured()) {
      return { ok: false, error: "Twilio is not configured." };
    }

    const number = String(formData.get("number") ?? "").trim();
    if (!number || !number.startsWith("+")) {
      return { ok: false, error: "A valid E.164 phone number is required." };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const smsUrl = `${appUrl}/api/sms/inbound`;
    const voiceUrl = `${appUrl}/api/calling/voice`;
    const statusCallbackUrl = `${appUrl}/api/sms/status`;

    const { sid, number: purchasedNumber } = await purchaseNumber(
      number,
      smsUrl,
      voiceUrl,
      statusCallbackUrl
    );

    await prisma.phoneNumber.upsert({
      where: { provider_number: { provider: "twilio", number: purchasedNumber } },
      create: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        number: purchasedNumber,
        provider: "twilio",
        capability: "sms_voice",
        status: "active",
        twilioSid: sid,
      },
      update: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId,
        status: "active",
        twilioSid: sid,
      },
    });

    await auditLog({
      agencyId: user.agencyId,
      actorUserId: user.id,
      action: "CREATE",
      entityType: "PhoneNumber",
      metadata: { number: purchasedNumber, twilioSid: sid },
    });

    revalidatePath("/sms");
    revalidatePath("/calling");

    return { ok: true };
  } catch (err) {
    console.error("[sms/actions] provisionTwilioNumber failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to provision number." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Release (delete) a phone number
// ─────────────────────────────────────────────────────────────────────────────

export async function releasePhoneNumber(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireWritableSmsAccess();

    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false, error: "Phone number ID is required." };

    // Verify ownership
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId },
    });

    if (!phoneNumber) {
      return { ok: false, error: "Phone number not found or access denied." };
    }

    // Release from Twilio if we have a SID
    if (phoneNumber.twilioSid) {
      try {
        await releaseNumber(phoneNumber.twilioSid);
      } catch (err) {
        console.error("[sms/actions] Twilio release failed:", err);
        // Continue — still delete from DB even if Twilio call fails
      }
    }

    await prisma.phoneNumber.delete({ where: { id: phoneNumber.id } });

    await auditLog({
      agencyId: user.agencyId,
      actorUserId: user.id,
      action: "DELETE",
      entityType: "PhoneNumber",
      entityId: phoneNumber.id,
      metadata: { number: phoneNumber.number, twilioSid: phoneNumber.twilioSid },
    });

    revalidatePath("/sms");
    revalidatePath("/calling");

    return { ok: true };
  } catch (err) {
    console.error("[sms/actions] releasePhoneNumber failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Failed to release number." };
  }
}
