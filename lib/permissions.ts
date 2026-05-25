import type { AgencyRole, SubAccountRole } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Resource and Action types
// ─────────────────────────────────────────────────────────────────────────────

export type Resource =
  | "contacts"
  | "conversations"
  | "calendars"
  | "opportunities"
  | "pipelines"
  | "automations"
  | "marketing"
  | "sites"
  | "settings"
  | "team"
  | "billing"
  | "reports"
  | "phone-numbers"
  | "tags"
  | "custom-fields"
  | "sub-accounts"
  | "credentials";

export type Action = "read" | "write" | "delete" | "export" | "import" | "publish" | "invite" | "deactivate" | "send";

type PermissionMap = Partial<Record<Action, boolean>>;
type PolicyMap = Partial<Record<Resource, PermissionMap>>;

// ─────────────────────────────────────────────────────────────────────────────
// Agency-level permission matrix
// ─────────────────────────────────────────────────────────────────────────────

const AGENCY_POLICIES: Record<AgencyRole, PolicyMap> = {
  OWNER: {
    contacts:       { read: true, write: true, delete: true, export: true, import: true },
    conversations:  { read: true, write: true, delete: true },
    calendars:      { read: true, write: true, delete: true },
    opportunities:  { read: true, write: true, delete: true },
    pipelines:      { read: true, write: true, delete: true },
    automations:    { read: true, write: true, delete: true, publish: true },
    marketing:      { read: true, write: true, delete: true, send: true },
    sites:          { read: true, write: true, delete: true, publish: true },
    settings:       { read: true, write: true },
    team:           { read: true, write: true, invite: true, deactivate: true },
    billing:        { read: true, write: true },
    reports:        { read: true, export: true },
    "phone-numbers": { read: true, write: true, delete: true },
    tags:           { read: true, write: true, delete: true },
    "custom-fields": { read: true, write: true, delete: true },
    "sub-accounts": { read: true, write: true, delete: true },
    credentials:    { read: true, write: true, delete: true },
  },

  ADMIN: {
    contacts:       { read: true, write: true, delete: true, export: true, import: true },
    conversations:  { read: true, write: true, delete: true },
    calendars:      { read: true, write: true, delete: true },
    opportunities:  { read: true, write: true, delete: true },
    pipelines:      { read: true, write: true, delete: true },
    automations:    { read: true, write: true, delete: true, publish: true },
    marketing:      { read: true, write: true, delete: true, send: true },
    sites:          { read: true, write: true, delete: true, publish: true },
    settings:       { read: true, write: true },
    team:           { read: true, invite: true },    // cannot deactivate OWNER
    billing:        { read: true },                  // cannot manage billing
    reports:        { read: true, export: true },
    "phone-numbers": { read: true, write: true, delete: true },
    tags:           { read: true, write: true, delete: true },
    "custom-fields": { read: true, write: true, delete: true },
    "sub-accounts": { read: true, write: true },
    credentials:    { read: true, write: true },
  },

  MEMBER: {
    contacts:       { read: true, write: true, export: true },
    conversations:  { read: true, write: true },
    calendars:      { read: true, write: true },
    opportunities:  { read: true, write: true },
    pipelines:      { read: true },
    automations:    { read: true },
    marketing:      { read: true },
    sites:          { read: true },
    settings:       { read: true },
    team:           { read: true },
    billing:        {},
    reports:        { read: true },
    "phone-numbers": { read: true },
    tags:           { read: true, write: true },
    "custom-fields": { read: true },
    "sub-accounts": { read: true },
    credentials:    {},
  },

  READ_ONLY: {
    contacts:       { read: true },
    conversations:  { read: true },
    calendars:      { read: true },
    opportunities:  { read: true },
    pipelines:      { read: true },
    automations:    { read: true },
    marketing:      { read: true },
    sites:          { read: true },
    settings:       { read: true },
    team:           { read: true },
    billing:        {},
    reports:        { read: true },
    "phone-numbers": { read: true },
    tags:           { read: true },
    "custom-fields": { read: true },
    "sub-accounts": { read: true },
    credentials:    {},
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-account-level permission matrix
// ─────────────────────────────────────────────────────────────────────────────

const SUBACCOUNT_POLICIES: Record<SubAccountRole, PolicyMap> = {
  ADMIN: {
    contacts:       { read: true, write: true, delete: true, export: true, import: true },
    conversations:  { read: true, write: true, delete: true },
    calendars:      { read: true, write: true, delete: true },
    opportunities:  { read: true, write: true, delete: true },
    pipelines:      { read: true, write: true, delete: true },
    automations:    { read: true, write: true, delete: true, publish: true },
    marketing:      { read: true, write: true, delete: true, send: true },
    sites:          { read: true, write: true, delete: true, publish: true },
    settings:       { read: true, write: true },
    team:           { read: true, invite: true },
    reports:        { read: true, export: true },
    "phone-numbers": { read: true, write: true },
    tags:           { read: true, write: true, delete: true },
    "custom-fields": { read: true, write: true },
    credentials:    { read: true, write: true },
  },

  SALES: {
    contacts:       { read: true, write: true, export: true, import: true },
    conversations:  { read: true, write: true },
    calendars:      { read: true, write: true },
    opportunities:  { read: true, write: true },
    pipelines:      { read: true },
    automations:    { read: true },
    marketing:      { read: true },
    sites:          { read: true },
    settings:       { read: true },
    team:           { read: true },
    reports:        { read: true },
    "phone-numbers": { read: true },
    tags:           { read: true, write: true },
    "custom-fields": { read: true },
    credentials:    {},
  },

  SUPPORT: {
    contacts:       { read: true },
    conversations:  { read: true, write: true },
    calendars:      { read: true },
    opportunities:  { read: true },
    pipelines:      { read: true },
    automations:    { read: true },
    marketing:      { read: true },
    sites:          { read: true },
    settings:       { read: true },
    team:           { read: true },
    reports:        { read: true },
    "phone-numbers": { read: true },
    tags:           { read: true },
    "custom-fields": { read: true },
    credentials:    {},
  },

  READ_ONLY: {
    contacts:       { read: true },
    conversations:  { read: true },
    calendars:      { read: true },
    opportunities:  { read: true },
    pipelines:      { read: true },
    automations:    { read: true },
    marketing:      { read: true },
    sites:          { read: true },
    settings:       { read: true },
    team:           { read: true },
    reports:        { read: true },
    "phone-numbers": { read: true },
    tags:           { read: true },
    "custom-fields": { read: true },
    credentials:    {},
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Permission check functions
// ─────────────────────────────────────────────────────────────────────────────

/** Check if an agency role has permission to perform an action on a resource */
export function agencyCan(role: AgencyRole, resource: Resource, action: Action): boolean {
  return AGENCY_POLICIES[role]?.[resource]?.[action] === true;
}

/** Check if a sub-account role has permission to perform an action on a resource */
export function subAccountCan(role: SubAccountRole | null, resource: Resource, action: Action): boolean {
  if (!role) return false;
  return SUBACCOUNT_POLICIES[role]?.[resource]?.[action] === true;
}

/**
 * Returns true if the user (agency member + optional sub-account member) can
 * perform the action on the resource. Agency OWNER/ADMIN always supersede
 * sub-account restrictions.
 */
export function can(
  agencyRole: AgencyRole,
  subAccountRole: SubAccountRole | null,
  resource: Resource,
  action: Action
): boolean {
  // Agency-level check first — OWNER and ADMIN can bypass sub-account limits
  if (agencyCan(agencyRole, resource, action)) return true;
  // Fall through to sub-account-level check
  return subAccountCan(subAccountRole, resource, action);
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience short-hands (backward compatible with existing code)
// ─────────────────────────────────────────────────────────────────────────────

export function canWriteAgency(role: AgencyRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canWriteSubAccount(role: SubAccountRole | null): boolean {
  return role === "ADMIN" || role === "SALES" || role === "SUPPORT";
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission error class — throw this from server actions / API routes
// ─────────────────────────────────────────────────────────────────────────────

export class PermissionError extends Error {
  readonly code = "PERMISSION_DENIED" as const;

  constructor(resource: Resource, action: Action) {
    super(`You do not have permission to ${action} ${resource}.`);
    this.name = "PermissionError";
  }
}

/**
 * Assert that the given user can perform the action, throwing PermissionError otherwise.
 * Use this at the top of every server action and API handler.
 *
 * @example
 *   assertCan(user.agencyRole, user.subAccountRole, "contacts", "delete");
 */
export function assertCan(
  agencyRole: AgencyRole,
  subAccountRole: SubAccountRole | null,
  resource: Resource,
  action: Action
): void {
  if (!can(agencyRole, subAccountRole, resource, action)) {
    throw new PermissionError(resource, action);
  }
}
