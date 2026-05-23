import type { AutomationActionType, AutomationTriggerType } from "@/lib/automations/catalog";

export type AutomationTrigger = {
  id: string;
  type: AutomationTriggerType;
  name: string;
  config: Record<string, string>;
};

export type AutomationStep = {
  id: string;
  type: AutomationActionType;
  name: string;
  config: Record<string, string>;
  trueBranch?: AutomationStep[];
  falseBranch?: AutomationStep[];
};

export type AutomationDefinition = {
  triggers: AutomationTrigger[];
  steps: AutomationStep[];
  settings: {
    allowMultipleRuns: boolean;
  };
};

export const emptyAutomationDefinition: AutomationDefinition = {
  triggers: [],
  steps: [],
  settings: {
    allowMultipleRuns: true
  }
};

export function parseAutomationDefinition(value: unknown): AutomationDefinition {
  if (!value || typeof value !== "object") {
    return emptyAutomationDefinition;
  }

  const candidate = value as Partial<AutomationDefinition>;

  return {
    triggers: Array.isArray(candidate.triggers) ? candidate.triggers : [],
    steps: Array.isArray(candidate.steps) ? candidate.steps : [],
    settings: {
      allowMultipleRuns: candidate.settings?.allowMultipleRuns ?? true
    }
  };
}
