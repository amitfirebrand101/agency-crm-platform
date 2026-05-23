import { URL } from "url";

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^localhost$/i
];

export function validateWebhookUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid webhook URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Webhook URL must use http or https.");
  }

  const host = parsed.hostname.toLowerCase();
  for (const pattern of PRIVATE_RANGES) {
    if (pattern.test(host)) {
      throw new Error("Webhook URL targets a private or reserved address.");
    }
  }

  return parsed;
}

export async function safeWebhookFetch(
  url: string,
  body: unknown,
  timeoutMs = 10_000
): Promise<{ ok: boolean; status: number; body: string }> {
  const parsed = validateWebhookUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(parsed.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "GoLowLevel-Webhook/1.0"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text().catch(() => "");
    return { ok: response.ok, status: response.status, body: text.slice(0, 2000) };
  } finally {
    clearTimeout(timer);
  }
}
