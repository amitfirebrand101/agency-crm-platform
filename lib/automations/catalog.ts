export const triggerCatalog = [
  { type: "CONTACT_CREATED", label: "Contact Created", category: "Contact", executable: true },
  { type: "CONTACT_TAG", label: "Contact Tag Added", category: "Contact", executable: true },
  { type: "INBOUND_WEBHOOK", label: "Inbound Webhook", category: "Events", executable: true },
  { type: "OPPORTUNITY_CREATED", label: "Opportunity Created", category: "Opportunities", executable: true },
  { type: "OPPORTUNITY_STATUS", label: "Opportunity Status Changed", category: "Opportunities", executable: true },
  { type: "APPOINTMENT_STATUS", label: "Appointment Status Changed", category: "Appointments", executable: false },
  { type: "FORM_SUBMITTED", label: "Form Submitted", category: "Events", executable: false },
  { type: "CUSTOMER_REPLIED", label: "Customer Replied", category: "Events", executable: false },
  { type: "SCHEDULER", label: "Scheduled / Recurring", category: "Events", executable: false }
] as const;

export const actionCatalog = [
  { type: "CREATE_CONTACT", label: "Create Contact", category: "Contact Actions", executable: true },
  { type: "UPDATE_CONTACT_FIELD", label: "Update Contact Field", category: "Contact Actions", executable: true },
  { type: "ADD_CONTACT_TAG", label: "Add Contact Tag", category: "Contact Actions", executable: true },
  { type: "REMOVE_CONTACT_TAG", label: "Remove Contact Tag", category: "Contact Actions", executable: true },
  { type: "CREATE_CONVERSATION", label: "Create Conversation", category: "Communication", executable: true },
  { type: "CREATE_OPPORTUNITY", label: "Create Opportunity", category: "Opportunities", executable: true },
  { type: "OUTBOUND_WEBHOOK", label: "Send Webhook", category: "Integrations", executable: true },
  { type: "WAIT", label: "Wait / Delay", category: "Flow Control", executable: true },
  { type: "IF_ELSE", label: "If / Else Branch", category: "Flow Control", executable: true },
  { type: "SEND_EMAIL", label: "Send Email", category: "Communication", executable: false },
  { type: "SEND_SMS", label: "Send SMS", category: "Communication", executable: false },
  { type: "ASSIGN_TO_USER", label: "Assign to User", category: "Contact Actions", executable: false },
  { type: "REMOVE_FROM_WORKFLOW", label: "Remove from Workflow", category: "Flow Control", executable: false }
] as const;

export type AutomationTriggerType = (typeof triggerCatalog)[number]["type"];
export type AutomationActionType = (typeof actionCatalog)[number]["type"];

export const triggerLabels = Object.fromEntries(triggerCatalog.map((item) => [item.type, item.label])) as Record<
  AutomationTriggerType,
  string
>;

export const actionLabels = Object.fromEntries(actionCatalog.map((item) => [item.type, item.label])) as Record<
  AutomationActionType,
  string
>;
