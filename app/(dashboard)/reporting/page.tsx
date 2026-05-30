import {
  Users,
  UserPlus,
  DollarSign,
  TrendingUp,
  CheckSquare,
  Calendar,
  MessageSquare,
  BarChart2,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatCents(cents: number): string {
  return "$" + (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default async function ReportingPage() {
  const user = await requireUser();
  const { agencyId, subAccountId } = user;
  const subAccountIdOrUndef = subAccountId ?? undefined;

  let databaseUnavailable = false;

  // ── Aggregated stats ────────────────────────────────────────────────────────

  let totalContacts = 0;
  let newContactsThisMonth = 0;
  let contactsByMonth: { createdAt: Date }[] = [];

  type StageBreakdown = {
    id: string;
    name: string;
    _count: { opportunities: number };
    opportunities: { valueCents: number }[];
  };
  let stageBreakdown: StageBreakdown[] = [];

  let wonOpps: { _sum: { valueCents: number | null }; _count: number } = { _sum: { valueCents: null }, _count: 0 };
  let lostOpps: { _sum: { valueCents: number | null }; _count: number } = { _sum: { valueCents: null }, _count: 0 };
  let openOpps: { _sum: { valueCents: number | null }; _count: number } = { _sum: { valueCents: null }, _count: 0 };

  let apptStats: { status: string; _count: number }[] = [];
  let convStats: { status: string; _count: number }[] = [];
  let openTasks = 0;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    [
      totalContacts,
      newContactsThisMonth,
      contactsByMonth,
      stageBreakdown,
      wonOpps,
      lostOpps,
      openOpps,
      apptStats,
      convStats,
      openTasks,
    ] = await Promise.all([
      prisma.contact.count({ where: { agencyId, subAccountId: subAccountIdOrUndef } }),
      prisma.contact.count({
        where: { agencyId, subAccountId: subAccountIdOrUndef, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.contact.findMany({
        where: { agencyId, subAccountId: subAccountIdOrUndef, createdAt: { gte: ninetyDaysAgo } },
        select: { createdAt: true },
      }),
      prisma.pipelineStage.findMany({
        where: { pipeline: { agencyId, subAccountId: subAccountIdOrUndef } },
        include: {
          _count: { select: { opportunities: { where: { status: "OPEN" } } } },
          opportunities: { where: { status: "OPEN" }, select: { valueCents: true } },
        },
        orderBy: { position: "asc" },
      }),
      prisma.opportunity.aggregate({
        where: { agencyId, subAccountId: subAccountIdOrUndef, status: "WON" },
        _sum: { valueCents: true },
        _count: true,
      }),
      prisma.opportunity.aggregate({
        where: { agencyId, subAccountId: subAccountIdOrUndef, status: "LOST" },
        _sum: { valueCents: true },
        _count: true,
      }),
      prisma.opportunity.aggregate({
        where: { agencyId, subAccountId: subAccountIdOrUndef, status: "OPEN" },
        _sum: { valueCents: true },
        _count: true,
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { calendar: { agencyId, subAccountId: subAccountIdOrUndef } },
        _count: true,
      }),
      prisma.conversation.groupBy({
        by: ["status"],
        where: { agencyId, subAccountId: subAccountIdOrUndef },
        _count: true,
      }),
      prisma.contactTask.count({
        where: { agencyId, subAccountId: subAccountIdOrUndef, completedAt: null },
      }),
    ]);
  } catch (error) {
    databaseUnavailable = true;
    console.error("Reporting page database query failed", error);
  }

  // ── Contacts over time (weekly buckets, last 10 weeks) ──────────────────────

  const weekMap = new Map<string, number>();
  for (const c of contactsByMonth) {
    const d = new Date(c.createdAt);
    d.setDate(d.getDate() - d.getDay()); // start of week (Sunday)
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
  }
  const weekData = [...weekMap.entries()].slice(-10);
  const maxWeekCount = Math.max(...weekData.map(([, v]) => v), 1);

  // ── Pipeline funnel ─────────────────────────────────────────────────────────

  const maxDeals = Math.max(...stageBreakdown.map((s) => s._count.opportunities), 1);

  // ── Win/loss stats ──────────────────────────────────────────────────────────

  const winRate =
    wonOpps._count > 0 || lostOpps._count > 0
      ? Math.round((wonOpps._count / (wonOpps._count + lostOpps._count)) * 100)
      : 0;

  const openPipelineValue = openOpps._sum.valueCents ?? 0;
  const wonRevenue = wonOpps._sum.valueCents ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Reporting</h1>
        <p className="mt-1 text-sm text-muted">Performance metrics for your CRM.</p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total Contacts</p>
              <p className="mt-1.5 text-3xl font-bold">{totalContacts}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Users className="text-blue-600" size={20} />
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">New This Month</p>
              <p className="mt-1.5 text-3xl font-bold text-primary">+{newContactsThisMonth}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <UserPlus className="text-primary" size={20} />
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Open Pipeline</p>
              <p className="mt-1.5 text-3xl font-bold">{formatCents(openPipelineValue)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
              <DollarSign className="text-amber-600" size={20} />
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Won Revenue</p>
              <p className="mt-1.5 text-3xl font-bold text-green-600">{formatCents(wonRevenue)}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <TrendingUp className="text-green-600" size={20} />
            </div>
          </div>
        </article>
      </div>

      {/* Contacts over time */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart2 className="text-primary" size={18} />
            <h2 className="font-semibold">New Contacts — Last 90 Days</h2>
            <span className="text-xs text-muted">(weekly)</span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
            {weekData.map(([label, count]) => (
              <div key={label} className="flex items-center gap-3 text-xs">
                <span className="w-16 shrink-0 text-right text-muted">{label}</span>
                <div className="flex-1 rounded bg-background h-6 overflow-hidden">
                  <div
                    className="h-full rounded bg-primary/70"
                    style={{
                      width: `${(count / maxWeekCount) * 100}%`,
                      minWidth: count > 0 ? "3px" : 0,
                    }}
                  />
                </div>
                <span className="w-5 font-semibold">{count}</span>
              </div>
            ))}
            {weekData.length === 0 && (
              <p className="text-sm text-muted">No contact data yet.</p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Pipeline funnel + Win/loss row */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Pipeline funnel */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Pipeline Funnel</h2>
          </CardHeader>
          <CardBody>
            {stageBreakdown.length === 0 ? (
              <p className="text-sm text-muted">No pipeline stages configured yet.</p>
            ) : (
              <div className="space-y-4">
                {stageBreakdown.map((stage) => {
                  const stageValue = stage.opportunities.reduce(
                    (acc, o) => acc + o.valueCents,
                    0
                  );
                  return (
                    <div key={stage.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{stage.name}</span>
                        <span className="text-muted">
                          {stage._count.opportunities} deal{stage._count.opportunities !== 1 ? "s" : ""}{" "}
                          &middot; {formatCents(stageValue)}
                        </span>
                      </div>
                      <div className="h-2 rounded bg-background overflow-hidden">
                        <div
                          className="h-full rounded bg-primary/60"
                          style={{
                            width: `${(stage._count.opportunities / maxDeals) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Win/loss + activity breakdown */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Performance Breakdown</h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {/* Win rate callout */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
                <span className="text-sm font-semibold text-muted uppercase tracking-wide text-xs">Win Rate</span>
                <span className="text-2xl font-bold text-green-600">{winRate}%</span>
              </div>

              {/* Opportunity rows */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted">Won deals</span>
                  <span className="font-semibold text-green-600">
                    {wonOpps._count} &middot; {formatCents(wonOpps._sum.valueCents ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-border">
                  <span className="text-muted">Lost deals</span>
                  <span className="font-semibold text-red-500">{lostOpps._count}</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-muted">Open deals</span>
                  <span className="font-semibold">
                    {openOpps._count} &middot; {formatCents(openOpps._sum.valueCents ?? 0)}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <hr className="border-border" />

              {/* Appointments */}
              {apptStats.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    <Calendar size={13} />
                    Appointments
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {apptStats.map((a) => (
                      <div key={a.status} className="flex items-center justify-between">
                        <span className="text-muted">{capitalize(a.status)}</span>
                        <span className="font-semibold">{a._count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversations */}
              {convStats.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    <MessageSquare size={13} />
                    Conversations
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {convStats.map((c) => (
                      <div key={String(c.status)} className="flex items-center justify-between">
                        <span className="text-muted">{capitalize(String(c.status))}</span>
                        <span className="font-semibold">{c._count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider */}
              <hr className="border-border" />

              {/* Open tasks */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-muted">
                  <CheckSquare size={13} />
                  Open Tasks
                </div>
                <span className="font-bold text-amber-600">{openTasks}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
