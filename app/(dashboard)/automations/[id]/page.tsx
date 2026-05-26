import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { History, Users, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { WorkflowBuilder } from "@/app/(dashboard)/automations/[id]/builder";
import { Card, CardBody } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function AutomationBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();

  const [automation, contacts, enrollmentStats, recentRuns] = await Promise.all([
    prisma.automation.findFirst({
      where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
    }),
    prisma.contact.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.automationEnrollment
      .groupBy({
        by: ["status"],
        where: {
          automationId: id,
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
        },
        _count: { status: true },
      })
      .catch(() => [] as Array<{ status: string; _count: { status: number } }>),
    prisma.automationRun
      .findMany({
        where: {
          automationId: id,
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
        },
        orderBy: { startedAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          triggerType: true,
          startedAt: true,
          completedAt: true,
          error: true,
          contactId: true,
        },
      })
      .catch(() => [] as RecentRun[]),
  ]);

  if (!automation) notFound();

  // Summarise enrollment status groups
  const totalEnrolled = enrollmentStats.reduce((s, g) => s + g._count.status, 0);
  const statByStatus: Record<string, number> = Object.fromEntries(
    enrollmentStats.map((g) => [g.status as string, g._count.status])
  );
  const activeEnrolled = (statByStatus["ACTIVE"] ?? 0) + (statByStatus["WAITING"] ?? 0);
  const completedEnrolled = statByStatus["COMPLETED"] ?? 0;
  const failedEnrolled = statByStatus["FAILED"] ?? 0;

  const hasStats = totalEnrolled > 0;
  const hasRuns = recentRuns.length > 0;
  const showSummary = hasStats || hasRuns;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  return (
    <>
      {/* ── Enrollment + recent-runs summary bar (above builder) ─────────── */}
      {showSummary && (
        <div className="-mx-5 -mt-6 lg:-mx-8 mb-0 shrink-0 border-b border-border bg-panel px-5 py-4 space-y-4 lg:px-8">
          {/* 4-column stat row */}
          {hasStats && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:max-w-xl">
              <StatCard
                label="Total Enrolled"
                value={totalEnrolled}
                color="text-foreground"
                icon={<Users size={13} />}
              />
              <StatCard
                label="Active"
                value={activeEnrolled}
                color="text-blue-600"
                icon={<Loader2 size={13} />}
              />
              <StatCard
                label="Completed"
                value={completedEnrolled}
                color="text-emerald-600"
                icon={<CheckCircle2 size={13} />}
              />
              <StatCard
                label="Failed"
                value={failedEnrolled}
                color={failedEnrolled > 0 ? "text-red-600" : "text-muted"}
                icon={<XCircle size={13} />}
              />
            </div>
          )}

          {/* Recent runs table */}
          {hasRuns && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider">
                  <History size={12} />
                  Recent Runs
                </div>
                <Link
                  href={`/automations/${id}/runs`}
                  className="text-xs text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="pb-1 pr-4 font-medium">Trigger</th>
                      <th className="pb-1 pr-4 font-medium">Status</th>
                      <th className="pb-1 pr-4 font-medium">Started</th>
                      <th className="pb-1 pr-4 font-medium">Duration</th>
                      <th className="pb-1 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentRuns.map((run) => {
                      const durationMs =
                        run.completedAt
                          ? run.completedAt.getTime() - run.startedAt.getTime()
                          : null;
                      return (
                        <tr key={run.id} className="hover:bg-background/40 transition">
                          <td className="py-1.5 pr-4 font-mono text-[10px] text-muted capitalize">
                            <Link
                              href={`/automations/${id}/runs/${run.id}`}
                              className="text-primary hover:underline mr-1.5 font-semibold"
                            >
                              {run.id.slice(0, 8)}
                            </Link>
                            {run.triggerType.replace(/_/g, " ").toLowerCase()}
                          </td>
                          <td className="py-1.5 pr-4">
                            <RunStatusPill status={run.status} />
                          </td>
                          <td className="py-1.5 pr-4 text-muted">
                            {new Date(run.startedAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="py-1.5 pr-4 text-muted">
                            {durationMs !== null
                              ? durationMs < 1000
                                ? `${durationMs}ms`
                                : `${(durationMs / 1000).toFixed(1)}s`
                              : "—"}
                          </td>
                          <td className="py-1.5 max-w-[200px] truncate text-red-600">
                            {run.error ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Workflow builder ─────────────────────────────────────────────── */}
      <WorkflowBuilder
        appUrl={appUrl}
        automation={{
          id: automation.id,
          name: automation.name,
          status: automation.status,
          definition: automation.definition,
        }}
        contacts={contacts}
      />
    </>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RecentRun = {
  id: string;
  status: string;
  triggerType: string;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
  contactId: string | null;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardBody>
        <div className={`flex items-center gap-1.5 text-xl font-bold ${color}`}>
          {icon}
          {value === 0 ? "—" : value}
        </div>
        <div className="mt-0.5 text-xs text-muted">{label}</div>
      </CardBody>
    </Card>
  );
}

function RunStatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: "bg-emerald-100 text-emerald-700",
    FAILED: "bg-red-100 text-red-700",
    WAITING: "bg-amber-100 text-amber-700",
    RUNNING: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-gray-100 text-gray-600",
    QUEUED: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          status === "COMPLETED" ? "bg-emerald-500" :
          status === "FAILED" ? "bg-red-500" :
          status === "WAITING" ? "bg-amber-500" :
          status === "RUNNING" ? "bg-blue-500" :
          "bg-gray-400"
        }`}
      />
      {status.toLowerCase()}
    </span>
  );
}
