/**
 * Twilio SMS delivery status callback.
 * Configure this URL in your Twilio phone number / messaging service settings:
 *   https://yourdomain.com/api/sms/status  (HTTP POST)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTwilioSignature } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = String(v); });

  // Verify Twilio signature when auth token is present
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const sig = req.headers.get("X-Twilio-Signature") ?? "";
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/sms/status`;
    if (!validateTwilioSignature(sig, url, params)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const { MessageSid, MessageStatus } = params;

  if (!MessageSid || !MessageStatus) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await prisma.message.updateMany({
      where: { twilioSid: MessageSid },
      data: { status: MessageStatus },
    });
  } catch (err) {
    console.error("[sms/status] Failed to update message status:", err);
    // Return 200 so Twilio doesn't retry — the message may not exist yet
  }

  return new NextResponse(null, { status: 204 });
}
