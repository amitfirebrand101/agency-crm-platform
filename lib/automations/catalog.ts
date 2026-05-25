import {
  ArrowRight,
  BarChart2,
  Bell,
  Bot,
  Cake,
  Calendar,
  CheckSquare,
  Clock,
  DollarSign,
  FileText,
  GitBranch,
  Mail,
  MessageSquare,
  Repeat,
  Reply,
  Shuffle,
  Star,
  StickyNote,
  Tag,
  Target,
  TrendingUp,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  Webhook,
} from "lucide-react";
import type { ComponentType } from "react";

export type IconType = ComponentType<{ size?: number; className?: string }>;

export type TriggerCategory = "Contact" | "Appointments" | "Opportunities" | "Events" | "Payments";
export type ActionCategory = "Contact" | "Communication" | "Opportunities" | "Appointments" | "Flow Control" | "Integrations";

export type ConfigField = {
  key: string;
  label: string;
  type: "text" | "select" | "textarea" | "number";
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
};

export type TriggerDef = {
  type: string;
  label: string;
  description: string;
  category: TriggerCategory;
  icon: IconType;
  executable: boolean;
  configFields?: ConfigField[];
};

export type ActionDef = {
  type: string;
  label: string;
  description: string;
  category: ActionCategory;
  icon: IconType;
  color: string;
  colorLight: string;
  executable: boolean;
  configFields?: ConfigField[];
};

export const triggerCatalog: TriggerDef[] = [
  // Contact
  { type: "CONTACT_CREATED", label: "Contact Created", description: "Fires when a new contact is created", category: "Contact", icon: UserPlus, executable: true },
  { type: "CONTACT_CHANGED", label: "Contact Updated", description: "Fires when a contact's fields are updated", category: "Contact", icon: UserCog, executable: true },
  {
    type: "CONTACT_TAG", label: "Tag Added to Contact", description: "Fires when a specific tag is applied", category: "Contact", icon: Tag, executable: true,
    configFields: [{ key: "tagName", label: "Tag Name", type: "text", placeholder: "lead, customer…", required: true }]
  },
  {
    type: "CONTACT_TAG_REMOVED", label: "Tag Removed from Contact", description: "Fires when a specific tag is removed", category: "Contact", icon: Tag, executable: true,
    configFields: [{ key: "tagName", label: "Tag Name", type: "text", placeholder: "lead, customer…", required: true }]
  },
  { type: "NOTE_ADDED", label: "Note Added", description: "Fires when a note is added to a contact", category: "Contact", icon: StickyNote, executable: false },
  { type: "TASK_COMPLETED", label: "Task Completed", description: "Fires when a task is marked complete", category: "Contact", icon: CheckSquare, executable: false },
  {
    type: "BIRTHDAY_REMINDER", label: "Birthday Reminder", description: "Fires X days before a contact's birthday", category: "Contact", icon: Cake, executable: false,
    configFields: [{ key: "daysBefore", label: "Days Before", type: "number", placeholder: "1" }]
  },
  // Appointments
  {
    type: "APPOINTMENT_STATUS", label: "Appointment Status Changed", description: "Fires when an appointment status updates", category: "Appointments", icon: Calendar, executable: true,
    configFields: [{
      key: "status", label: "Filter by Status", type: "select",
      options: [{ value: "", label: "Any status" }, { value: "confirmed", label: "Confirmed" }, { value: "cancelled", label: "Cancelled" }, { value: "no_show", label: "No show" }, { value: "completed", label: "Completed" }]
    }]
  },
  { type: "CUSTOMER_BOOKED_APPOINTMENT", label: "Appointment Booked", description: "Fires when a contact books an appointment", category: "Appointments", icon: Calendar, executable: false },
  // Opportunities
  { type: "OPPORTUNITY_CREATED", label: "Opportunity Created", description: "Fires when a new opportunity is created", category: "Opportunities", icon: Target, executable: true },
  {
    type: "OPPORTUNITY_STATUS", label: "Opportunity Status Changed", description: "Fires when an opportunity is won, lost, or abandoned", category: "Opportunities", icon: TrendingUp, executable: true,
    configFields: [{
      key: "status", label: "Filter by Status", type: "select",
      options: [{ value: "", label: "Any status" }, { value: "won", label: "Won" }, { value: "lost", label: "Lost" }, { value: "abandoned", label: "Abandoned" }]
    }]
  },
  { type: "PIPELINE_STAGE_CHANGED", label: "Pipeline Stage Changed", description: "Fires when an opportunity moves stages", category: "Opportunities", icon: ArrowRight, executable: true },
  // Events
  {
    type: "FORM_SUBMITTED", label: "Form Submitted", description: "Fires when a form is submitted", category: "Events", icon: FileText, executable: false,
    configFields: [{ key: "formName", label: "Form Name (optional)", type: "text", placeholder: "Contact form…" }]
  },
  {
    type: "CUSTOMER_REPLIED", label: "Customer Replied", description: "Fires when a contact sends a reply", category: "Events", icon: Reply, executable: false,
    configFields: [{
      key: "channel", label: "Channel", type: "select",
      options: [{ value: "", label: "Any channel" }, { value: "SMS", label: "SMS" }, { value: "Email", label: "Email" }]
    }]
  },
  { type: "INBOUND_WEBHOOK", label: "Inbound Webhook", description: "Fires when your webhook URL receives a POST", category: "Events", icon: Webhook, executable: true },
  {
    type: "SCHEDULER", label: "Scheduled / Recurring", description: "Fires on a fixed schedule", category: "Events", icon: Repeat, executable: false,
    configFields: [{
      key: "frequency", label: "Frequency", type: "select",
      options: [{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]
    }]
  },
  { type: "REVIEW_RECEIVED", label: "Review Received", description: "Fires when a contact submits a review", category: "Events", icon: Star, executable: false },
  // Payments
  { type: "PAYMENT_RECEIVED", label: "Payment Received", description: "Fires when a payment is processed", category: "Payments", icon: DollarSign, executable: false },
];

export const actionCatalog: ActionDef[] = [
  // Contact
  {
    type: "CREATE_CONTACT", label: "Create Contact", description: "Add a new contact to the CRM",
    category: "Contact", icon: UserPlus, color: "bg-blue-600", colorLight: "bg-blue-50", executable: true,
    configFields: [
      { key: "firstName", label: "First Name", type: "text", placeholder: "{{trigger.firstName}}" },
      { key: "lastName", label: "Last Name", type: "text", placeholder: "{{trigger.lastName}}" },
      { key: "email", label: "Email", type: "text", placeholder: "{{trigger.email}}" },
    ]
  },
  {
    type: "UPDATE_CONTACT_FIELD", label: "Update Contact Field", description: "Modify a specific field on the contact",
    category: "Contact", icon: UserCog, color: "bg-blue-600", colorLight: "bg-blue-50", executable: true,
    configFields: [
      {
        key: "field", label: "Field", type: "select",
        options: [{ value: "source", label: "Source" }, { value: "status", label: "Status" }, { value: "phone", label: "Phone" }, { value: "email", label: "Email" }, { value: "firstName", label: "First Name" }, { value: "lastName", label: "Last Name" }]
      },
      { key: "value", label: "New Value", type: "text", placeholder: "New value…", required: true },
    ]
  },
  {
    type: "ADD_CONTACT_TAG", label: "Add Tag", description: "Apply a tag to the contact",
    category: "Contact", icon: Tag, color: "bg-blue-600", colorLight: "bg-blue-50", executable: true,
    configFields: [{ key: "tagName", label: "Tag Name", type: "text", placeholder: "lead, hot-prospect…", required: true }]
  },
  {
    type: "REMOVE_CONTACT_TAG", label: "Remove Tag", description: "Remove a tag from the contact",
    category: "Contact", icon: Tag, color: "bg-blue-600", colorLight: "bg-blue-50", executable: true,
    configFields: [{ key: "tagName", label: "Tag Name", type: "text", placeholder: "lead, hot-prospect…", required: true }]
  },
  {
    type: "ASSIGN_TO_USER", label: "Assign to User", description: "Assign the contact to a team member",
    category: "Contact", icon: UserCheck, color: "bg-blue-600", colorLight: "bg-blue-50", executable: true,
    configFields: [{ key: "userId", label: "User Email", type: "text", placeholder: "user@agency.com" }]
  },
  {
    type: "REMOVE_ASSIGNED_USER", label: "Remove Assigned User", description: "Clear the current assigned user from the contact",
    category: "Contact", icon: UserMinus, color: "bg-blue-600", colorLight: "bg-blue-50", executable: true,
  },
  {
    type: "SET_DND", label: "Set Do Not Disturb", description: "Enable or disable email/SMS opt-out flags",
    category: "Contact", icon: Bell, color: "bg-blue-600", colorLight: "bg-blue-50", executable: true,
    configFields: [
      {
        key: "channel", label: "Channel", type: "select",
        options: [{ value: "both", label: "Email and SMS" }, { value: "email", label: "Email" }, { value: "sms", label: "SMS" }]
      },
      {
        key: "enabled", label: "DND Enabled", type: "select",
        options: [{ value: "true", label: "Enabled" }, { value: "false", label: "Disabled" }]
      }
    ]
  },
  {
    type: "ADD_NOTE", label: "Add Note", description: "Append a note to the contact record",
    category: "Contact", icon: StickyNote, color: "bg-blue-600", colorLight: "bg-blue-50", executable: true,
    configFields: [{ key: "note", label: "Note", type: "textarea", placeholder: "Contact moved to new stage…" }]
  },
  {
    type: "ADD_TASK", label: "Add Task", description: "Create a task linked to the contact",
    category: "Contact", icon: CheckSquare, color: "bg-blue-600", colorLight: "bg-blue-50", executable: false,
    configFields: [
      { key: "title", label: "Task Title", type: "text", placeholder: "Follow up with contact", required: true },
      { key: "dueDays", label: "Due in (days)", type: "number", placeholder: "3" },
    ]
  },
  {
    type: "DELETE_CONTACT", label: "Delete Contact", description: "Permanently remove the contact",
    category: "Contact", icon: UserMinus, color: "bg-red-600", colorLight: "bg-red-50", executable: true,
    configFields: [{ key: "confirm", label: "Type DELETE to confirm", type: "text", placeholder: "DELETE", required: true }]
  },
  // Communication
  {
    type: "SEND_EMAIL", label: "Send Email", description: "Send an email to the contact",
    category: "Communication", icon: Mail, color: "bg-emerald-600", colorLight: "bg-emerald-50", executable: false,
    configFields: [
      { key: "subject", label: "Subject", type: "text", placeholder: "Welcome to {{agency.name}}", required: true },
      { key: "body", label: "Body", type: "textarea", placeholder: "Hi {{contact.firstName}},…" },
    ]
  },
  {
    type: "SEND_SMS", label: "Send SMS", description: "Send an SMS to the contact",
    category: "Communication", icon: MessageSquare, color: "bg-emerald-600", colorLight: "bg-emerald-50", executable: false,
    configFields: [{ key: "message", label: "Message", type: "textarea", placeholder: "Hi {{contact.firstName}}…", required: true }]
  },
  {
    type: "SEND_INTERNAL_NOTIFICATION", label: "Internal Notification", description: "Notify a team member about this contact",
    category: "Communication", icon: Bell, color: "bg-emerald-600", colorLight: "bg-emerald-50", executable: true,
    configFields: [{ key: "message", label: "Message", type: "textarea", placeholder: "New lead: {{contact.name}}", required: true }]
  },
  {
    type: "SEND_REVIEW_REQUEST", label: "Send Review Request", description: "Ask the contact to leave a review",
    category: "Communication", icon: Star, color: "bg-emerald-600", colorLight: "bg-emerald-50", executable: false,
  },
  {
    type: "CREATE_CONVERSATION", label: "Create Conversation", description: "Start a new conversation thread",
    category: "Communication", icon: MessageSquare, color: "bg-emerald-600", colorLight: "bg-emerald-50", executable: true,
    configFields: [
      { key: "subject", label: "Subject", type: "text", placeholder: "Automation conversation" },
      {
        key: "channel", label: "Channel", type: "select",
        options: [{ value: "SMS", label: "SMS" }, { value: "EMAIL", label: "Email" }, { value: "INTERNAL_NOTE", label: "Internal note" }]
      }
    ]
  },
  // Opportunities
  {
    type: "CREATE_OPPORTUNITY", label: "Create Opportunity", description: "Add the contact to a pipeline",
    category: "Opportunities", icon: Target, color: "bg-violet-600", colorLight: "bg-violet-50", executable: true,
    configFields: [
      { key: "name", label: "Name", type: "text", placeholder: "New deal", required: true },
      { key: "value", label: "Value ($)", type: "number", placeholder: "0" },
    ]
  },
  {
    type: "UPDATE_OPPORTUNITY", label: "Update Opportunity", description: "Update an opportunity's status",
    category: "Opportunities", icon: TrendingUp, color: "bg-violet-600", colorLight: "bg-violet-50", executable: true,
    configFields: [{
      key: "status", label: "Status", type: "select",
      options: [{ value: "open", label: "Open" }, { value: "won", label: "Won" }, { value: "lost", label: "Lost" }]
    }]
  },
  // Appointments
  {
    type: "UPDATE_APPOINTMENT_STATUS", label: "Update Appointment", description: "Change the status of an appointment",
    category: "Appointments", icon: Calendar, color: "bg-cyan-600", colorLight: "bg-cyan-50", executable: true,
    configFields: [{
      key: "status", label: "Status", type: "select",
      options: [{ value: "confirmed", label: "Confirmed" }, { value: "cancelled", label: "Cancelled" }, { value: "no_show", label: "No show" }, { value: "completed", label: "Completed" }]
    }]
  },
  // Flow Control
  {
    type: "WAIT", label: "Wait", description: "Pause the workflow for a set duration",
    category: "Flow Control", icon: Clock, color: "bg-amber-500", colorLight: "bg-amber-50", executable: true,
    configFields: [
      { key: "duration", label: "Duration", type: "number", placeholder: "5", required: true },
      {
        key: "unit", label: "Unit", type: "select",
        options: [{ value: "minutes", label: "Minutes" }, { value: "hours", label: "Hours" }, { value: "days", label: "Days" }]
      }
    ]
  },
  {
    type: "IF_ELSE", label: "If / Else", description: "Branch the workflow based on a condition",
    category: "Flow Control", icon: GitBranch, color: "bg-amber-500", colorLight: "bg-amber-50", executable: true,
    configFields: [
      {
        key: "conditionType", label: "Condition", type: "select",
        options: [
          { value: "contact.hasTag", label: "Contact has tag" },
          { value: "contact.fieldEquals", label: "Contact field equals" },
          { value: "opportunity.status", label: "Opportunity status is" },
          { value: "always.true", label: "Always true (pass-through)" },
        ]
      },
      { key: "value", label: "Value", type: "text", placeholder: "Tag name or field value…" }
    ]
  },
  {
    type: "SPLIT", label: "A/B Split", description: "Randomly split contacts into test groups",
    category: "Flow Control", icon: Shuffle, color: "bg-amber-500", colorLight: "bg-amber-50", executable: false,
    configFields: [{ key: "splitPercent", label: "Branch A %", type: "number", placeholder: "50" }]
  },
  {
    type: "GO_TO", label: "Go To Workflow", description: "Jump to another workflow",
    category: "Flow Control", icon: ArrowRight, color: "bg-amber-500", colorLight: "bg-amber-50", executable: false,
    configFields: [{ key: "workflowName", label: "Workflow Name", type: "text", placeholder: "Post-purchase follow-up" }]
  },
  {
    type: "REMOVE_FROM_WORKFLOW", label: "End Workflow", description: "Stop processing this contact here",
    category: "Flow Control", icon: UserMinus, color: "bg-slate-500", colorLight: "bg-slate-100", executable: true,
  },
  // Integrations
  {
    type: "OUTBOUND_WEBHOOK", label: "Webhook", description: "POST contact data to an external URL",
    category: "Integrations", icon: Webhook, color: "bg-slate-600", colorLight: "bg-slate-100", executable: true,
    configFields: [{ key: "url", label: "Webhook URL", type: "text", placeholder: "https://hooks.zapier.com/…", required: true }]
  },
  {
    type: "GOOGLE_SHEETS", label: "Google Sheets", description: "Append a row to a Google Sheet",
    category: "Integrations", icon: BarChart2, color: "bg-slate-600", colorLight: "bg-slate-100", executable: false,
    configFields: [{ key: "sheetUrl", label: "Sheet URL", type: "text", placeholder: "https://docs.google.com/…" }]
  },
  {
    type: "GPT_PROMPT", label: "AI Prompt", description: "Run a GPT prompt and store the result",
    category: "Flow Control", icon: Bot, color: "bg-purple-600", colorLight: "bg-purple-50", executable: false,
    configFields: [{ key: "prompt", label: "Prompt", type: "textarea", placeholder: "Summarize this contact's activity…", required: true }]
  },
];

export type AutomationTriggerType = string;
export type AutomationActionType = string;

export const triggerLabels = Object.fromEntries(triggerCatalog.map((t) => [t.type, t.label])) as Record<string, string>;
export const actionLabels = Object.fromEntries(actionCatalog.map((a) => [a.type, a.label])) as Record<string, string>;

export function getTriggerDef(type: string): TriggerDef | undefined {
  return triggerCatalog.find((t) => t.type === type);
}

export function getActionDef(type: string): ActionDef | undefined {
  return actionCatalog.find((a) => a.type === type);
}

export function getTriggersByCategory(): Partial<Record<TriggerCategory, TriggerDef[]>> {
  return triggerCatalog.reduce<Partial<Record<TriggerCategory, TriggerDef[]>>>((acc, t) => {
    acc[t.category] = [...(acc[t.category] ?? []), t];
    return acc;
  }, {});
}

export function getActionsByCategory(): Partial<Record<ActionCategory, ActionDef[]>> {
  return actionCatalog.reduce<Partial<Record<ActionCategory, ActionDef[]>>>((acc, a) => {
    acc[a.category] = [...(acc[a.category] ?? []), a];
    return acc;
  }, {});
}
