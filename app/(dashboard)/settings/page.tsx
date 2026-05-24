import { KeyRound, ScrollText, Shield, SlidersHorizontal, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAgency } from "@/app/(dashboard)/settings/actions";

export default async function SettingsPage() {
  const user = await requireUser();
  let databaseUnavailable = false;

  type AgencyRecord = {
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    country: string;
    members: Array<{ id: string; role: string; user: { name: string | null; email: string } }>;
  };

  let agency: AgencyRecord = {
    name: user.agencyName,
    slug: "—",
    timezone: "America/New_York",
    currency: "USD",
    country: "US",
    members: [{ id: user.id, role: user.agencyRole, user: { name: user.name, email: user.email } }]
  };

  let auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: Date;
    actor: { name: string | null; email: string } | null;
  }> = [];

  try {
    [agency, auditLogs] = await Promise.all([
      prisma.agency.findUniqueOrThrow({
        where: { id: user.agencyId },
        include: { members: { include: { user: true }, orderBy: { createdAt: "asc" } } }
      }),
      prisma.auditLog.findMany({
        where: { agencyId: user.agencyId },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { actor: { select: { name: true, email: true } } }
      })
    ]);
  } catch (error) {
    databaseUnavailable = true;
    console.error("Settings page database query failed", error);
  }

  const ROLE_VARIANT: Record<string, "success" | "info" | "muted"> = {
    OWNER: "success",
    ADMIN: "info",
    MEMBER: "muted",
    READ_ONLY: "muted"
  };

  const ACTION_LABELS: Record<string, string> = {
    CREATE: "Created",
    UPDATE: "Updated",
    DELETE: "Deleted",
    LOGIN: "Logged in",
    INVITE: "Invited"
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Agency profile, team management, and security audit log.</p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      {/* Summary stat row */}
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
          <div className="text-sm text-muted">Auth provider</div>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <UsersRound className="mb-3 text-primary" size={20} />
          <div className="font-semibold">{agency.members.length}</div>
          <div className="text-sm text-muted">Team members</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          {/* Agency profile edit */}
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
                <SubmitButton className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" pendingText="Saving…">
                  Save changes
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          {/* Team members */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <UsersRound className="text-primary" size={16} />
                <h2 className="font-semibold">Team members</h2>
              </div>
            </CardHeader>
            <CardBody>
              <div className="divide-y divide-border">
                {agency.members.map((member) => (
                  <div className="flex items-center justify-between gap-4 py-3" key={member.id}>
                    <div>
                      <div className="font-medium">{member.user.name ?? member.user.email}</div>
                      <div className="text-sm text-muted">{member.user.email}</div>
                    </div>
                    <Badge variant={ROLE_VARIANT[member.role] ?? "muted"}>{member.role}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border border-dashed border-border p-3 text-sm text-muted">
                Invite flow is coming soon. Contact support to add team members.
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Audit log */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ScrollText className="text-primary" size={16} />
              <h2 className="font-semibold">Audit log</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-border">
              {auditLogs.map((log) => (
                <div className="py-3" key={log.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          log.action === "DELETE" ? "danger" :
                          log.action === "CREATE" ? "success" :
                          log.action === "LOGIN" ? "info" : "muted"
                        }
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                      <span className="text-sm">{log.entityType}</span>
                      {log.entityId ? (
                        <span className="font-mono text-xs text-muted">{log.entityId.slice(0, 8)}</span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted">{new Date(log.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {log.actor ? `${log.actor.name ?? log.actor.email}` : "System"} · {new Date(log.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
              {!auditLogs.length ? <p className="py-4 text-sm text-muted">No audit events recorded yet.</p> : null}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
