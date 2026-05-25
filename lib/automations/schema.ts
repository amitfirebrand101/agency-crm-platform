import { z } from "zod";

// ── Constants ─────────────────────────────────────────────────────────────────

export const MAX_STEPS = 50;
export const MAX_TRIGGERS = 10;
export const MAX_PAYLOAD_BYTES = 65_536; // 64 KB

// ── Enumerations ──────────────────────────────────────────────────────────────

export const ALL_TRIGGER_TYPES = [
  "CONTACT_CREATED",
  "CONTACT_CHANGED",
  "CONTACT_TAG",
  "CONTACT_TAG_REMOVED",
  "APPOINTMENT_STATUS",
  "OPPORTUNITY_CREATED",
  "OPPORTUNITY_STATUS",
  "PIPELINE_STAGE_CHANGED",
  "INBOUND_WEBHOOK",
  "FORM_SUBMITTED",
  "CUSTOMER_REPLIED",
  "SCHEDULER",
] as const;

export const EXECUTABLE_TRIGGER_TYPES = new Set<string>([
  "CONTACT_CREATED",
  "CONTACT_CHANGED",
  "CONTACT_TAG",
  "CONTACT_TAG_REMOVED",
  "APPOINTMENT_STATUS",
  "OPPORTUNITY_CREATED",
  "OPPORTUNITY_STATUS",
  "PIPELINE_STAGE_CHANGED",
  "INBOUND_WEBHOOK",
]);

export const ALL_STEP_TYPES = [
  "CREATE_CONTACT",
  "UPDATE_CONTACT_FIELD",
  "ADD_CONTACT_TAG",
  "REMOVE_CONTACT_TAG",
  "REMOVE_ASSIGNED_USER",
  "SET_DND",
  "ADD_NOTE",
  "DELETE_CONTACT",
  "CREATE_CONVERSATION",
  "CREATE_OPPORTUNITY",
  "UPDATE_OPPORTUNITY",
  "UPDATE_APPOINTMENT_STATUS",
  "WAIT",
  "IF_ELSE",
  "OUTBOUND_WEBHOOK",
  "SEND_SMS",
  "SEND_EMAIL",
  "SEND_INTERNAL_NOTIFICATION",
  "ASSIGN_TO_USER",
  "REMOVE_FROM_WORKFLOW",
] as const;

export const PROVIDER_REQUIRED_STEPS = new Set<string>(["SEND_SMS", "SEND_EMAIL"]);

export type TriggerType = (typeof ALL_TRIGGER_TYPES)[number];
export type StepType = (typeof ALL_STEP_TYPES)[number];

// Step run status (TS enum — matches string values stored in DB)
export const StepRunStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  WAITING: "WAITING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
  CANCELLED: "CANCELLED",
} as const;
export type StepRunStatus = (typeof StepRunStatus)[keyof typeof StepRunStatus];

// ── Node schemas ──────────────────────────────────────────────────────────────

export const triggerNodeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(ALL_TRIGGER_TYPES),
  name: z.string().trim().min(1).max(200),
  config: z.record(z.string(), z.string()).default({}),
});

// Branch steps use unknown[] here; validated recursively by validateDefinition()
export const stepNodeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(ALL_STEP_TYPES),
  name: z.string().trim().min(1).max(200),
  config: z.record(z.string(), z.string()).default({}),
  trueBranch: z.array(z.unknown()).optional(),
  falseBranch: z.array(z.unknown()).optional(),
});

export const workflowSettingsSchema = z.object({
  allowMultipleRuns: z.boolean().default(true),
  stopOnError: z.boolean().default(false),
});

export const workflowDefinitionSchema = z.object({
  version: z.number().int().min(1).default(1),
  triggers: z.array(triggerNodeSchema).max(MAX_TRIGGERS),
  steps: z.array(stepNodeSchema).max(MAX_STEPS),
  settings: workflowSettingsSchema.default({ allowMultipleRuns: true, stopOnError: false }),
  metadata: z
    .object({ description: z.string().trim().max(500).optional() })
    .optional(),
});

export type TriggerNode = z.infer<typeof triggerNodeSchema>;
export type StepNode = z.infer<typeof stepNodeSchema>;
export type WorkflowSettings = z.infer<typeof workflowSettingsSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

// ── Step-specific config validators ──────────────────────────────────────────

const safeHttpUrl = z
  .string()
  .url()
  .refine((url) => {
    try {
      const u = new URL(url);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "URL must use http or https — javascript: and data: are not allowed");

export const waitConfigSchema = z.object({
  duration: z.coerce.number().int().positive().max(525_600, "Max wait is 1 year"),
  unit: z.enum(["minutes", "hours", "days"]),
});

export const ifElseConfigSchema = z.object({
  conditionType: z.enum([
    "contact.hasTag",
    "contact.fieldEquals",
    "contact.status.is",
    "opportunity.status",
    "always.true",
    "always.false",
  ]),
  field: z.string().trim().max(100).optional(),
  value: z.string().trim().max(500).optional(),
  tagName: z.string().trim().max(100).optional(),
});

export const outboundWebhookConfigSchema = z.object({
  url: safeHttpUrl,
  method: z.enum(["POST", "GET", "PUT"]).default("POST"),
});

// ── Recursive step validator ──────────────────────────────────────────────────

function validateStepNode(raw: unknown, path: string): string[] {
  const errs: string[] = [];
  const r = stepNodeSchema.safeParse(raw);
  if (!r.success) {
    r.error.issues.forEach((e) => errs.push(`${path}.${e.path.join(".")}: ${e.message}`));
    return errs;
  }
  const s = r.data;

  if (s.type === "WAIT") {
    const cr = waitConfigSchema.safeParse(s.config);
    if (!cr.success) errs.push(`${path} (WAIT): ${cr.error.issues[0]?.message}`);
  }
  if (s.type === "IF_ELSE") {
    const cr = ifElseConfigSchema.safeParse(s.config);
    if (!cr.success) errs.push(`${path} (IF_ELSE): ${cr.error.issues[0]?.message}`);
    (s.trueBranch ?? []).forEach((b, i) =>
      errs.push(...validateStepNode(b, `${path}.trueBranch[${i}]`))
    );
    (s.falseBranch ?? []).forEach((b, i) =>
      errs.push(...validateStepNode(b, `${path}.falseBranch[${i}]`))
    );
  }
  if (s.type === "OUTBOUND_WEBHOOK") {
    const cr = outboundWebhookConfigSchema.safeParse(s.config);
    if (!cr.success) errs.push(`${path} (OUTBOUND_WEBHOOK): ${cr.error.issues[0]?.message}`);
  }
  if (s.type === "ADD_NOTE" || s.type === "SEND_INTERNAL_NOTIFICATION") {
    const body = s.config.note ?? s.config.message;
    if (!body?.trim()) errs.push(`${path}: message is required`);
  }
  if (s.type === "DELETE_CONTACT" && s.config.confirm !== "DELETE") {
    errs.push(`${path}: confirm must be DELETE`);
  }
  if (s.type === "SET_DND") {
    if (!["email", "sms", "both"].includes(s.config.channel ?? "")) {
      errs.push(`${path}: channel must be email, sms, or both`);
    }
    if (!["true", "false"].includes(s.config.enabled ?? "")) {
      errs.push(`${path}: enabled must be true or false`);
    }
  }
  if (s.type === "ADD_CONTACT_TAG" || s.type === "REMOVE_CONTACT_TAG") {
    if (!s.config.tagName?.trim()) errs.push(`${path}: tagName is required`);
  }
  if (s.type === "UPDATE_CONTACT_FIELD") {
    if (!s.config.field) errs.push(`${path}: field is required`);
    if (s.config.value === undefined || s.config.value === null)
      errs.push(`${path}: value is required`);
  }
  return errs;
}

// ── Public validation API ─────────────────────────────────────────────────────

export function validateDefinition(raw: unknown): { valid: boolean; errors: string[] } {
  const top = workflowDefinitionSchema.safeParse(raw);
  if (!top.success) {
    return {
      valid: false,
      errors: top.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }
  const def = top.data;
  const errors: string[] = [];

  if (def.triggers.length === 0) errors.push("Workflow must have at least one trigger.");
  if (def.steps.length === 0) errors.push("Workflow must have at least one action step.");

  for (const t of def.triggers) {
    if (!EXECUTABLE_TRIGGER_TYPES.has(t.type)) {
      errors.push(`Trigger "${t.type}" is not yet executable in this environment.`);
    }
    if (t.type === "INBOUND_WEBHOOK" && !t.config.token) {
      errors.push("INBOUND_WEBHOOK trigger requires a security token.");
    }
    if (
      (t.type === "CONTACT_TAG" || t.type === "CONTACT_TAG_REMOVED") &&
      !t.config.tagName?.trim()
    ) {
      errors.push(`Tag trigger "${t.name}" requires a tagName.`);
    }
  }

  def.steps.forEach((step, i) => errors.push(...validateStepNode(step, `steps[${i}]`)));

  return { valid: errors.length === 0, errors };
}

/** Lenient parse — returns empty definition on failure instead of throwing. */
export function parseDefinition(raw: unknown): WorkflowDefinition {
  const r = workflowDefinitionSchema.safeParse(raw);
  if (r.success) return r.data;
  return {
    version: 1,
    triggers: [],
    steps: [],
    settings: { allowMultipleRuns: true, stopOnError: false },
  };
}
