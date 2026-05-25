/**
 * Twilio inbound SMS webhook.
 * Configure this URL in your Twilio phone number settings:
 *   https://yourdomain.com/api/sms/inbound  (HTTP POST)
 *
 * If TWILIO_AUTH_TOKEN is set, the Twilio signature is verified.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTwilioSignature } from "@/lib/twilio";

function twimlResponse(body: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${body ? `<Message>${body}</Message>` : ""}</Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = String(v); });

  const { From, To, Body, MessageSid, SmsSid } = params;
  const sid = MessageSid ?? SmsSid;

  // Signature verification when auth token is present
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const sig = req.headers.get("X-Twilio-Signature") ?? "";
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/sms/inbound`;
    if (!validateTwilioSignature(sig, url, params)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  if (!From || !Body) return twimlResponse("");

  // Find the sub-account that owns the "To" number
  let subAccountId: string | null = null;
  let agencyId: string | null = null;
  try {
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { number: To },
      select: { subAccountId: true, agencyId: true },
    });
    subAccountId = phoneNumber?.subAccountId ?? null;
    agencyId = phoneNumber?.agencyId ?? null;
  } catch { /* tables may not have column yet */ }

  if (!subAccountId || !agencyId) return twimlResponse("");

  // Find or create contact by phone number
  let contactId: string | null = null;
  try {
    const contact = await prisma.contact.findFirst({
      where: { subAccountId, phone: From },
      select: { id: true },
    });
    if (contact) {
      contactId = contact.id;
    } else {
      const newContact = await prisma.contact.create({
        data: {
          agencyId,
          subAccountId,
          firstName: From,
          phone: From,
          source: "SMS inbound",
        },
      });
      contactId = newContact.id;
    }
  } catch (err) {
    console.error("[sms/inbound] contact lookup failed:", err);
  }

  // Find existing open SMS conversation for this contact, or create one
  try {
    let conversation = await prisma.conversation.findFirst({
      where: { subAccountId, contactId: contactId ?? undefined, channel: "SMS", status: { not: "CLOSED" } },
      select: { id: true },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          agencyId,
          subAccountId,
          contactId,
          channel: "SMS",
          subject: `SMS from ${From}`,
        },
      });
    }

    // Deduplicate by Twilio SID
    if (sid) {
      const existing = await prisma.message.findUnique({ where: { twilioSid: sid }, select: { id: true } });
      if (existing) return twimlResponse("");
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        body: Body,
        direction: "inbound",
        twilioSid: sid ?? null,
      },
    });
  } catch (err) {
    console.error("[sms/inbound] message create failed:", err);
  }

  return twimlResponse("");
}
