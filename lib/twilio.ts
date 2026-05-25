import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

function getClient() {
  if (!accountSid || !authToken) throw new Error("Twilio credentials not configured.");
  return twilio(accountSid, authToken);
}

export function twilioConfigured() {
  return Boolean(accountSid && authToken && fromNumber);
}

export async function sendSms(to: string, body: string): Promise<string> {
  if (!fromNumber) throw new Error("TWILIO_FROM_NUMBER is not set.");
  const client = getClient();
  const msg = await client.messages.create({ to, from: fromNumber, body });
  return msg.sid;
}

export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  if (!authToken) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}
