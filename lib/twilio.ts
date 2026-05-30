import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

function getClient() {
  if (!accountSid || !authToken) throw new Error("Twilio credentials not configured.");
  return twilio(accountSid, authToken);
}

export function twilioConfigured(): boolean {
  return Boolean(accountSid && authToken && fromNumber);
}

export function voiceConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_API_KEY &&
    process.env.TWILIO_API_SECRET &&
    process.env.TWILIO_TWIML_APP_SID
  );
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

export interface AvailableNumber {
  number: string;
  locality: string;
  region: string;
  capabilities: {
    sms: boolean;
    voice: boolean;
    mms: boolean;
  };
}

export async function searchNumbers(
  areaCode: string,
  smsEnabled: boolean,
  voiceEnabled: boolean
): Promise<AvailableNumber[]> {
  const client = getClient();
  const results = await client.availablePhoneNumbers("US").local.list({
    areaCode: parseInt(areaCode, 10),
    smsEnabled,
    voiceEnabled,
    limit: 20,
  });

  return results.map((n) => ({
    number: n.phoneNumber,
    locality: n.locality ?? "",
    region: n.region ?? "",
    capabilities: {
      sms: n.capabilities?.sms ?? false,
      voice: n.capabilities?.voice ?? false,
      mms: n.capabilities?.mms ?? false,
    },
  }));
}

export interface PurchasedNumber {
  sid: string;
  number: string;
}

export async function purchaseNumber(
  number: string,
  smsUrl: string,
  voiceUrl: string,
  statusCallbackUrl: string
): Promise<PurchasedNumber> {
  const client = getClient();
  const result = await client.incomingPhoneNumbers.create({
    phoneNumber: number,
    smsUrl,
    smsMethod: "POST",
    voiceUrl,
    voiceMethod: "POST",
    statusCallback: statusCallbackUrl,
    statusCallbackMethod: "POST",
  });
  return { sid: result.sid, number: result.phoneNumber };
}

export async function releaseNumber(twilioSid: string): Promise<void> {
  const client = getClient();
  await client.incomingPhoneNumbers(twilioSid).remove();
}

export function generateVoiceToken(identity: string): string {
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;
  const sid = accountSid;

  if (!sid || !apiKey || !apiSecret || !twimlAppSid) {
    throw new Error("Voice credentials not fully configured (TWILIO_API_KEY, TWILIO_API_SECRET, TWILIO_TWIML_APP_SID required).");
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  const token = new AccessToken(sid, apiKey, apiSecret, {
    identity,
    ttl: 3600,
  });
  token.addGrant(voiceGrant);

  return token.toJwt();
}
