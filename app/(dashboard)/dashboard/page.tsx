import Link from "next/link";
import { Bot, CalendarDays, ContactRound, MessageSquareText, Target, TrendingUp } from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await requireUser();
  let databaseUnavailable = false;

  let contactCount = 0;
  let openConversations = 0;
  let publishedAutomations = 0;
  let openOpportunityValue = 0;
  let openOpportunityCount = 0;
  let upcomingAppointments = 0;

  let recentContacts: Array<{ id: string; firstName: string; lastName: string | null; email: string | null; source: string | null; status: string; createdAt: Date }> = [];
  let recentRuns: Array<{ id: string; triggerType: string; status: string; startedAt: Date; automation: { name: string } | null }> = [];
  let pipelineByStage: Array<{ stageName: string; count: number; value: number }> = [];

  try {
    const now = new Date();

    const [
      contacts,
      openConvCount,
      automationPub,
      openOpps,
      upcomingApts,
      runs,
      stageSummary
    ] = await Promise.all([
      prisma.contact.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, firstName: true, lastName: true, email: true, source: true, status: true, createdAt: true }
      }),
      prisma.conversation.count({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined, status: "OPEN" }
      }),
      prisma.automation.count({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined, status: "published" }
      }),
      prisma.opportunity.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined, status: "OPEN" },
        select: { valueCents: true }
      }),
      prisma.appointment.count({
        where: {
          calendar: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
          startsAt: { gte: now },
          status: { notIn: ["cancelled", "no_show"] }
        }
      }),
      prisma.automationRun.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { startedAt: "desc" },
        take: 6,
        include: { automation: { select: { name: true } } }
      }),
      prisma.pipelineStage.findMany({
        where: { pipeline: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined } },
        include: {
          _count: { select: { opportunities: { where: { status: "OPEN" } } } },
          opportunities: { where: { status: "OPEN" }, select: { valueCents: true } }
        },
        orderBy: { position: "asc" }
      })
    ]);

    contactCount = await prisma.contact.count({ where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined } });
    openConversations = openConvCount;
    publishedAutomations = automationPub;
    openOpportunityCount = openOpps.length;
    openOpportunityValue = openOpps.reduce((s, o) => s + o.valueCents, 0);
    upcomingAppointments = upcomingApts;
    recentContacts = contacts;
    recentRuns = runs;
    pipelineByStage = stageSummary.map((s) => ({
      stageName: s.name,
      count: s._count.opportunities,
      value: s.opportunities.reduce((acc, o) => acc + o.valueCents, 0)
    })).filter((s) => s.count > 0);
  } catch (error) {
    databaseUnavailable = true;
    console.error("Dashboard database query failed", error);
  }

  return (
    <div className="space-y-6">
      {databaseUnavailable ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Database connection is not ready. The app shell is available but live CRM data will appear after Vercel can reach Supabase.
        </div>
      ) : null}

      {/* KPI row */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contacts" value={contactCount.toLocaleString()} helper="Total CRM records" />
        <StatCard label="Open conversations" value={openConversations.toLocaleString()} helper="Awaiting response" />
        <StatCard
          label="Pipeline value"
          value={`$${(openOpportunityValue / 100).toLocaleString()}`}
          helper={`${openOpportunityCount} open deals`}
        />
        <StatCard label="Upcoming appts." value={upcomingAppointments.toLocaleString()} helper="Scheduled appointments" />
      </section>

      {/* Main content grid */}
      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Recent contacts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ContactRound className="text-primary" size={18} />
                <h2 className="font-semibold">Recent contacts</h2>
              </div>
              <Link className="text-sm text-primary hover:underline" href="/contacts">View all</Link>
            </div>
          </CardHeader>
          <CardBody>
            {recentContacts.length ? (
              <div className="divide-y divide-border">
                {recentContacts.map((contact) => (
                  <Link className="flex items-center justify-between gap-4 py-3 hover:bg-background transition" href={`/contacts/${contact.id}`} key={contact.id}>
                    <div>
                      <div className="font-medium">
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div className="text-sm text-muted">{contact.email ?? "No email"} · {contact.source ?? "Direct"}</div>
                    </div>
                    <Badge variant={statusVariant(contact.status)}>{contact.status}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted">
                No contacts yet.{" "}
                <Link className="text-primary underline" href="/contacts">
                  Add your first contact
                </Link>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          {/* Pipeline summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Target className="text-primary" size={18} />
                  <h2 className="font-semibold">Pipeline</h2>
                </div>
                <Link className="text-sm text-primary hover:underline" href="/opportunities">View all</Link>
              </div>
            </CardHeader>
            <CardBody>
              {pipelineByStage.length ? (
                <div className="space-y-3">
                  {pipelineByStage.map((stage) => (
                    <div className="flex items-center justify-between text-sm" key={stage.stageName}>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="text-muted" size={14} />
                        <span>{stage.stageName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted">{stage.count} deals</span>
                        <span className="font-semibold">${(stage.value / 100).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No open opportunities.{" "}
                  <Link className="text-primary underline" href="/opportunities">
                    Create a pipeline
                  </Link>
                </p>
              )}
            </CardBody>
          </Card>

          {/* Stats */}
          <div className="grid gap-4 grid-cols-2">
            <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
              <div className="flex items-center gap-2 text-muted mb-2">
                <Bot size={16} />
                <span className="text-sm">Automations</span>
              </div>
              <div className="text-2xl font-semibold">{publishedAutomations}</div>
              <div className="text-xs text-muted">Published</div>
            </div>
            <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
              <div className="flex items-center gap-2 text-muted mb-2">
                <MessageSquareText size={16} />
                <span className="text-sm">Conversations</span>
              </div>
              <div className="text-2xl font-semibold">{openConversations}</div>
              <div className="text-xs text-muted">Open</div>
            </div>
          </div>
        </div>
      </section>

      {/* Automation runs */}
      {recentRuns.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Bot className="text-primary" size={18} />
                <h2 className="font-semibold">Recent automation runs</h2>
              </div>
              <Link className="text-sm text-primary hover:underline" href="/automations">View automations</Link>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-background text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Workflow</th>
                  <th className="px-4 py-3 font-medium">Trigger</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-3 font-medium">{run.automation?.name ?? "Unknown"}</td>
                    <td className="px-4 py-3 text-muted">{run.triggerType}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">{new Date(run.startedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Upcoming appointments */}
      {upcomingAppointments > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="text-primary" size={18} />
                <h2 className="font-semibold">Upcoming appointments</h2>
              </div>
              <Link className="text-sm text-primary hover:underline" href="/calendars">View calendars</Link>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-muted">
              {upcomingAppointments} appointment{upcomingAppointments !== 1 ? "s" : ""} scheduled. Open a calendar to manage them.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
