/**
 * Backward-compatible executor façade.
 * New code should call engine.ts directly.
 */

import { prisma } from "@/lib/prisma";
import { parseDefinition } from "@/lib/automations/schema";
import {
  runAutomationsForEvent as engineRunAutomationsForEvent,
  enrollAndRun,
} from "@/lib/automations/engine";

type LegacyEvent = {
  type: string;
  agencyId: string;
  subAccountId: string;
  contactId?: string | null;
  payload?: Record<string, unknown>;
};

/** Matches automations by trigger type and dispatches via the engine. */
export async function runAutomationsForEvent(event: LegacyEvent): Promise<void> {
  await engineRunAutomationsForEvent(event);
}

/** Direct automation run (test / explicit trigger). Uses engine internally. */
export async function runAutomation(input: {
  automationId: string;
  agencyId: string;
  subAccountId: string;
  contactId?: string | null;
  actorUserId?: string | null;
  triggerType?: string;
  payload?: Record<string, unknown>;
}): Promise<{ executed: boolean; results: unknown[] }> {
  const automation = await prisma.automation.findFirst({
    where: {
      id: input.automationId,
      agencyId: input.agencyId,
      subAccountId: input.subAccountId,
    },
  });

  if (!automation) return { executed: false, results: [] };

  const definition = parseDefinition(automation.definition);

  const result = await enrollAndRun({
    automationId: automation.id,
    versionId: null,
    agencyId: input.agencyId,
    subAccountId: input.subAccountId,
    contactId: input.contactId,
    triggerType: input.triggerType ?? "CONTACT_CREATED",
    payload: input.payload ?? {},
    idempotencyKey: `direct:${automation.id}:${input.contactId ?? "none"}:${Date.now()}`,
    definition,
    isTestRun: input.payload?.test === true,
  });

  return { executed: true, results: result.stepResults };
}
