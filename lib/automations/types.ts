// Re-export canonical types from schema.ts.
// Keeping backward-compat aliases so existing imports don't break.

export type {
  TriggerNode as AutomationTrigger,
  StepNode as AutomationStep,
  WorkflowDefinition as AutomationDefinition,
  WorkflowSettings,
  TriggerType,
  StepType,
} from "@/lib/automations/schema";

export { parseDefinition as parseAutomationDefinition } from "@/lib/automations/schema";

export const emptyAutomationDefinition = {
  version: 1 as const,
  triggers: [] as never[],
  steps: [] as never[],
  settings: { allowMultipleRuns: true, stopOnError: false },
};
