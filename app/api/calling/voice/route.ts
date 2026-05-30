/**
 * Twilio inbound call TwiML webhook.
 * Configure this URL in your Twilio phone number settings:
 *   https://yourdomain.com/api/calling/voice  (HTTP POST, Voice webhook)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTwilioSignature } from "@/lib/twilio";

function twimlResponse(xml: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = String(v); });

  // Verify Twilio signature when auth token is present
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const sig = req.headers.get("X-Twilio-Signature") ?? "";
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin}/api/calling/voice`;
    if (!validateTwilioSignature(sig, url, params)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const { From, To, CallSid } = params;

  if (!From || !To) {
    return twimlResponse(
      "<Say>You have reached this number. Please leave a message after the tone.</Say><Record maxLength=\"60\" />"
    );
  }

  // Look up sub-account that owns the "To" number
  let subAccountId: string | null = null;
  let agencyId: string | null = null;
  try {
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: { number: To },
      select: { subAccountId: true, agencyId: true },
    });
    subAccountId = phoneNumber?.subAccountId ?? null;
    agencyId = phoneNumber?.agencyId ?? null;
  } catch (err) {
    console.error("[calling/voice] phone number lookup failed:", err);
  }

  if (!subAccountId || !agencyId) {
    return twimlResponse(
      "<Say>You have reached this number. Please leave a message after the tone.</Say><Record maxLength=\"60\" />"
    );
  }

  // Find or create contact by caller's phone number
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
          source: "Inbound call",
        },
      });
      contactId = newContact.id;
    }
  } catch (err) {
    console.error("[calling/voice] contact lookup/create failed:", err);
  }

  // Find or create a CALL conversation for this contact
  try {
    let conversation = await prisma.conversation.findFirst({
      where: {
        subAccountId,
        contactId: contactId ?? undefined,
        channel: "CALL",
        status: { not: "CLOSED" },
      },
      select: { id: true },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          agencyId,
          subAccountId,
          contactId,
          channel: "CALL",
          subject: `Inbound call from ${From}`,
        },
      });
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        body: `Inbound call from ${From}`,
        direction: "inbound",
        twilioSid: CallSid ?? null,
        status: "received",
      },
    });
  } catch (err) {
    console.error("[calling/voice] conversation/message create failed:", err);
  }

  return twimlResponse(
    "<Say>You have reached this number. Please leave a message after the tone.</Say><Record maxLength=\"60\" />"
  );
}
