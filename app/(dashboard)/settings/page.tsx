import { type AuditAction } from "@prisma/client";
import { KeyRound, Link2, ScrollText, Shield, SlidersHorizontal, UserMinus, UserPlus, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { InviteForm } from "@/app/(dashboard)/settings/invite-form";
import {
  updateAgency,
  deactivateMember,
  reactivateMember,
  revokeInvite,
} from "@/app/(dashboard)/settings/actions";

export const dynamic = "force-dynamic";

const ROLE_VARIANT: Record<string, "success" | "info" | "muted"> = {
  OWNER:     "success",
  ADMIN:     "info",
  MEMBER:    "muted",
  READ_ONLY: "muted",
};

const ACTION_VARIANT: Record<string, "danger" | "success" | "info" | "warning" | "muted"> = {
  CREATE:           "success",
  UPDATE:           "info",
  DELETE:           "danger",
  LOGIN:            "info",
  LOGOUT:           "muted",
  INVITE:           "info",
  INVITE_ACCEPTED:  "success",
  DEACTIVATE:       "warning",
  REACTIVATE:       "success",
  EXPORT:           "muted",
  IMPORT:           "muted",
  PERMISSION_DENIED: "danger",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE:           "Created",
  UPDATE:           "Updated",
  DELETE:           "Deleted",
  LOGIN:            "Logged in",
  LOGOUT:           "Logged out",
  INVITE:           "Invited",
  INVITE_ACCEPTED:  "Invite accepted",
  DEACTIVATE:       "Deactivated",
  REACTIVATE:       "Reactivated",
  EXPORT:           "Exported",
  IMPORT:           "Imported",
  PERMISSION_DENIED: "Permission denied",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ action?: string }>;
}) {
  const params     = await searchParams;
  const logFilter  = params?.action ?? "";
  const user       = await requireUser();
  let databaseUnavailable = false;

  // Defaults for DB-unavailable state
  let agency = {
    id:       user.agencyId,
    name:     user.agencyName,
    slug:     "—",
    timezone: "America/New_York",
    currency: "USD",
    country:  "US",
    members:  [] as Array<{
      id: string;
      role: string;
      deactivatedAt: Date | null;
      user: { name: string | null; email: string };
    }>,
  };
  let pendingInvites: Array<{
    id: string;
    email: string;
    role: string;
    expiresAt: Date;
  }> = [];
  let auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    ipAddress: string | null;
    createdAt: Date;
    actor: { name: string | null; email: string } | null;
  }> = [];

  try {
    [agency, pendingInvites, auditLogs] = await Promise.all([
      prisma.agency.findUniqueOrThrow({
        where:   { id: user.agencyId },
        include: {
          members: {
            include:   { user: { select: { name: true, email: true } } },
            orderBy:   { createdAt: "asc" },
          },
        },
      }) as Promise<typeof agency>,
      prisma.userInvite.findMany({
        where:   { agencyId: user.agencyId, acceptedAt: null, revokedAt: null, expiresAt: { gte: new Date() } },
        orderBy: { createdAt: "desc" },
        select:  { id: true, email: true, role: true, expiresAt: true },
      }),
      prisma.auditLog.findMany({
        where: {
          agencyId: user.agencyId,
          ...(logFilter ? { action: logFilter as AuditAction } : {}),
        },
        orderBy: { createdAt: "desc" },
        take:    50,
        include: { actor: { select: { name: true, email: true } } },
      }),
    ]);
  } catch (error) {
    databaseUnavailable = true;
    console.error("Settings page database query failed", error);
  }

  const canInvite     = can(user.agencyRole, user.subAccountRole, "team", "invite");
  const canDeactivate = can(user.agencyRole, user.subAccountRole, "team", "deactivate");
  const canEditAgency = can(user.agencyRole, user.subAccountRole, "settings", "write");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Agency profile, team management, and security audit log.</p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <SlidersHorizontal className="mb-3 text-primary" size={20} />
          <div className="font-semibold">{agency.name}</div>
          <div className="text-sm text-muted">/{agency.slug}</div>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <Shield className="mb-3 text-primary" size={20} />
          <div className="font-semibold">{agency.country}</div>
          <div className="text-sm text-muted">{agency.timezone}</div>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <KeyRound className="mb-3 text-primary" size={20} />
          <div className="font-semibold">Supabase Auth</div>
          <div className="text-sm text-muted">
            {process.env.AUTH_DISABLED === "true"
              ? <span className="text-amber-600 font-semibold">Auth disabled (dev)</span>
              : "Active"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <UsersRound className="mb-3 text-primary" size={20} />
          <div className="font-semibold">
            {agency.members.filter((m) => !m.deactivatedAt).length}
          </div>
          <div className="text-sm text-muted">Active members</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          {/* Agency profile */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="text-primary" size={16} />
                <h2 className="font-semibold">Agency profile</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={updateAgency} className="space-y-3">
                <Field label="Agency name" name="name" defaultValue={agency.name} required />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Timezone" name="timezone" defaultValue={agency.timezone} placeholder="America/New_York" />
                  <Field label="Currency" name="currency" defaultValue={agency.currency} placeholder="USD" />
                </div>
                <Field label="Country (2-letter)" name="country" defaultValue={agency.country} placeholder="US" />
                {canEditAgency && (
                  <SubmitButton
                    className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
                    pendingText="Saving…"
                  >
                    Save changes
                  </SubmitButton>
                )}
              </form>
            </CardBody>
          </Card>

          {/* Invite member */}
          {canInvite && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <UserPlus className="text-primary" size={16} />
                  <h2 className="font-semibold">Invite team member</h2>
                </div>
              </CardHeader>
              <CardBody>
                <InviteForm agencyRole={user.agencyRole} />
              </CardBody>
            </Card>
          )}

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Link2 className="text-primary" size={16} />
                  <h2 className="font-semibold">Pending invites</h2>
                  <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                    {pendingInvites.length}
                  </span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="divide-y divide-border">
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <div className="text-sm font-medium">{invite.email}</div>
                        <div className="text-xs text-muted">
                          {ROLE_VARIANT[invite.role] ? invite.role : invite.role} ·
                          Expires {new Date(invite.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                      {canInvite && (
                        <form action={revokeInvite.bind(null, invite.id)}>
                          <button
                            type="submit"
                            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition"
                          >
                            Revoke
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Team members */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UsersRound className="text-primary" size={16} />
                <h2 className="font-semibold">Team members</h2>
                <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                  {agency.members.length}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <div className="divide-y divide-border">
                {agency.members.map((member) => {
                  const isYou         = member.user.email === user.email;
                  const isDeactivated = !!member.deactivatedAt;
                  return (
                    <div
                      key={member.id}
                      className={[
                        "flex items-center justify-between gap-4 py-3",
                        isDeactivated ? "opacity-50" : "",
                      ].join(" ")}
                    >
                      <div>
                        <div className="flex items-center gap-2 font-medium">
                          {member.user.name ?? member.user.email}
                          {isYou && (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                              You
                            </span>
                          )}
                          {isDeactivated && (
                            <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-600">
                              Deactivated
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted">{member.user.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={ROLE_VARIANT[member.role] ?? "muted"}>
                          {member.role}
                        </Badge>
                        {canDeactivate && !isYou && member.role !== "OWNER" && (
                          isDeactivated ? (
                            <form action={reactivateMember.bind(null, member.id)}>
                              <button
                                type="submit"
                                className="rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-background transition"
                              >
                                Reactivate
                              </button>
                            </form>
                          ) : (
                            <form action={deactivateMember.bind(null, member.id)}>
                              <button
                                type="submit"
                                className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition"
                              >
                                <UserMinus size={11} />
                                Deactivate
                              </button>
                            </form>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Audit log with filter */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <ScrollText className="text-primary" size={16} />
                <h2 className="font-semibold">Audit log</h2>
              </div>
              <form method="GET" className="flex items-center gap-2">
                <select
                  name="action"
                  defaultValue={logFilter}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="">All events</option>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-background transition"
                >
                  Filter
                </button>
              </form>
            </div>
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-border">
              {auditLogs.map((log) => (
                <div className="py-3" key={log.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={ACTION_VARIANT[log.action] ?? "muted"}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                      <span className="text-sm text-foreground">{log.entityType}</span>
                      {log.entityId && (
                        <span className="font-mono text-xs text-muted">
                          {log.entityId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    <span>
                      {log.actor
                        ? (log.actor.name ?? log.actor.email)
                        : "System"}
                    </span>
                    <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                    {log.ipAddress && (
                      <span className="font-mono">{log.ipAddress}</span>
                    )}
                  </div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <p className="py-6 text-center text-sm text-muted">
                  {logFilter ? "No events match this filter." : "No audit events recorded yet."}
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
