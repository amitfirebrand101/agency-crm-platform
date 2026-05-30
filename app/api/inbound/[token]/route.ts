import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Headers that should never be forwarded (authentication / internal)
const BLOCKED_HEADER_PREFIXES = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-auth",
  "proxy-authorization",
];

function isSafeHeader(name: string): boolean {
  const lower = name.toLowerCase();
  return !BLOCKED_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function getSafeHeaders(req: NextRequest): Record<string, string> {
  const safe: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (isSafeHeader(key)) {
      safe[key] = value;
    }
  });
  return safe;
}

function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? null;
  }
  return req.headers.get("x-real-ip") ?? null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await params;

  const webhook = await prisma.inboundWebhook.findUnique({
    where: { token },
    select: {
      id: true,
      active: true,
    },
  });

  if (!webhook || !webhook.active) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Parse body — fall back to { raw: text } if not valid JSON
  let payload: unknown;
  try {
    const text = await req.text();
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  } catch {
    payload = {};
  }

  const safeHeaders = getSafeHeaders(req);
  const ipAddress = getClientIp(req);

  // Persist delivery + update counters in a transaction
  await prisma.$transaction([
    prisma.inboundWebhookDelivery.create({
      data: {
        inboundWebhookId: webhook.id,
        ipAddress,
        headers: safeHeaders,
        payload: payload as Parameters<typeof prisma.inboundWebhookDelivery.create>[0]["data"]["payload"],
      },
    }),
    prisma.inboundWebhook.update({
      where: { id: webhook.id },
      data: {
        receiveCount: { increment: 1 },
        lastReceivedAt: new Date(),
      },
    }),
  ]);

  return NextResponse.json({ received: true }, { status: 200 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  const { token } = await params;

  const webhook = await prisma.inboundWebhook.findUnique({
    where: { token },
    select: {
      name: true,
      active: true,
      receiveCount: true,
    },
  });

  if (!webhook) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      name: webhook.name,
      active: webhook.active,
      receiveCount: webhook.receiveCount,
    },
    { status: 200 }
  );
}
