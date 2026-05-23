import { Bot, CalendarDays, ContactRound, MessageSquareText, PhoneCall, Target } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const moduleStats = [
  { label: "Conversations", value: "Ready", icon: MessageSquareText },
  { label: "Calendars", value: "Ready", icon: CalendarDays },
  { label: "Automations", value: "Schema", icon: Bot },
  { label: "Calling", value: "Provider next", icon: PhoneCall },
  { label: "Opportunities", value: "Schema", icon: Target }
];

export default async function DashboardPage() {
  const user = await requireUser();
  const [contactCount, subAccountCount, tagCount, recentContacts] = await Promise.all([
    prisma.contact.count({ where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined } }),
    prisma.subAccount.count({ where: { agencyId: user.agencyId } }),
    prisma.tag.count({ where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined } }),
    prisma.contact.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, firstName: true, lastName: true, email: true, source: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard helper="Tenant-isolated CRM records." label="Contacts" value={String(contactCount)} />
        <StatCard helper="Client locations under this agency." label="Sub accounts" value={String(subAccountCount)} />
        <StatCard helper="Workspace-specific segmentation." label="Tags" value={String(tagCount)} />
        <StatCard helper="Current signed-in role." label="Agency role" value={user.agencyRole} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ContactRound className="text-primary" size={19} />
              <h2 className="font-semibold">Recent contacts</h2>
            </div>
          </CardHeader>
          <CardBody>
            {recentContacts.length ? (
              <div className="divide-y divide-border">
                {recentContacts.map((contact) => (
                  <div className="flex items-center justify-between gap-4 py-3" key={contact.id}>
                    <div>
                      <div className="font-medium">
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div className="text-sm text-muted">{contact.email ?? "No email"}</div>
                    </div>
                    <div className="text-sm text-muted">{contact.source ?? "Direct"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted">
                No contacts yet. Add your first contact from the Contacts module.
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">Module readiness</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {moduleStats.map((item) => (
                <div className="flex items-center justify-between rounded-md border border-border bg-background p-3" key={item.label}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <item.icon className="text-primary" size={16} />
                    {item.label}
                  </div>
                  <span className="text-xs font-semibold uppercase text-muted">{item.value}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
