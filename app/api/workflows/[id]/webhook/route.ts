import { NextResponse, type NextRequest } from "next/server";
import { runAutomation } from "@/lib/automations/executor";
import { parseAutomationDefinition } from "@/lib/automations/types";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function handleWebhook(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const token = request.nextUrl.searchParams.get("token");
  const automation = await prisma.automation.findUnique({ where: { id } });

  if (!automation || automation.status !== "published") {
    return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
  }

  const definition = parseAutomationDefinition(automation.definition);
  const webhookTrigger = definition.triggers.find((trigger) => trigger.type === "INBOUND_WEBHOOK");

  if (!webhookTrigger) {
    return NextResponse.json({ error: "Workflow does not have an inbound webhook trigger." }, { status: 400 });
  }

  if (webhookTrigger.config.token && webhookTrigger.config.token !== token) {
    return NextResponse.json({ error: "Invalid webhook token." }, { status: 401 });
  }

  const payload =
    request.method === "GET"
      ? Object.fromEntries(request.nextUrl.searchParams)
      : ((await request.json().catch(() => ({}))) as Record<string, unknown>);

  const result = await runAutomation({
    automationId: automation.id,
    agencyId: automation.agencyId,
    subAccountId: automation.subAccountId,
    payload
  });

  return NextResponse.json({ ok: true, result });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleWebhook(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleWebhook(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return handleWebhook(request, context);
}
