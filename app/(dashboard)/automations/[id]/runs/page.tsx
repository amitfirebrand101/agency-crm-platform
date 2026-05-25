import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Play,
  UserCheck,
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cancelWorkflowEnrollment,
  resumeWorkflowEnrollment,
  retryWorkflowRun,
  runTestWorkflow,
} from "@/app/(dashboard)/automations/actions";

type RunWithSteps = Prisma.AutomationRunGetPayload<{
  include: { stepRuns: { orderBy: { createdAt: "asc" } } };
}>;

type EnrollmentRow = Prisma.AutomationEnrollmentGetPayload<{ select: {
  id: true; status: true; triggerType: true; contactId: true;
  resumeAt: true; currentStepId: true; startedAt: true; completedAt: true;
  cancelledAt: true;
}}>;

type PageProps = { params: Promise<{ id: string }> };

export default async function RunsPage({ params }: PageProps) {
  const { id: automationId } = await params;
  const user = await requireUser();

  const automation = await prisma.automation.findFirst({
    where: { id: automationId, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
    select: { id: true, name: true, status: true },
  });
  if (!automation) notFound();

  let runs: RunWithSteps[] = [];
  let enrollments: EnrollmentRow[] = [];
  let totalRuns = 0;
  let failedRuns = 0;
  let dbUnavailable = false;

  try {
    [runs, enrollments, totalRuns, failedRuns] = await Promise.all([
      prisma.automationRun.findMany({
        where: { automationId, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { startedAt: "desc" },
        take: 50,
        include: { stepRuns: { orderBy: { createdAt: "asc" } } },
      }),
      prisma.automationEnrollment.findMany({
        where: {
          automationId,
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
          status: { in: ["ACTIVE", "WAITING"] },
        },
        orderBy: { startedAt: "desc" },
        select: {
          id: true, status: true, triggerType: true, contactId: true,
          resumeAt: true, currentStepId: true, startedAt: true, completedAt: true,
          cancelledAt: true,
        },
      }),
      prisma.automationRun.count({ where: { automationId, agencyId: user.agencyId } }),
      prisma.automationRun.count({ where: { automationId, agencyId: user.agencyId, status: "FAILED" } }),
    ]);
  } catch {
    dbUnavailable = true;
  }

  const firstContact = user.subAccountId
    ? await prisma.contact.findFirst({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId },
        select: { id: true },
      }).catch(() => null)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/automations/${automationId}`}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">{automation.name}</span>
          </Link>
          <span className="text-muted/40">/</span>
          <div className="flex items-center gap-2">
            <History size={16} className="text-muted" />
            <h1 className="font-semibold">Run History</h1>
          </div>
        </div>

        <form action={runTestWorkflow}>
          <input type="hidden" name="automationId" value={automationId} />
          <input type="hidden" name="contactId" value={firstContact?.id ?? ""} />
          <SubmitButton
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background transition"
            pendingText="Running…"
          >
            <Play size={12} /> Test Run
          </SubmitButton>
        </form>
      </div>

      {dbUnavailable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Database unavailable — run the <code>add-automation-engine.sql</code> migration in Supabase.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:w-80">
        <Card><CardBody>
          <div className="text-xl font-bold">{totalRuns}</div>
          <div className="text-xs text-muted mt-0.5">Total runs</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xl font-bold text-red-600">{failedRuns}</div>
          <div className="text-xs text-muted mt-0.5">Failed</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xl font-bold text-amber-600">{enrollments.length}</div>
          <div className="text-xs text-muted mt-0.5">Waiting</div>
        </CardBody></Card>
      </div>

      {/* Active / waiting enrollments */}
      {enrollments.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock size={15} className="text-amber-500" />
              <h2 className="font-semibold text-sm">Active Enrollments</h2>
            </div>
          </CardHeader>
          <div className="divide-y divide-border">
            {enrollments.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                <EnrollmentStatusIcon status={e.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{e.triggerType.replace(/_/g, " ").toLowerCase()}</span>
                    <EnrollmentBadge status={e.status} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    Started {new Date(e.startedAt).toLocaleString()}
                    {e.resumeAt && (
                      <> · Resumes {new Date(e.resumeAt).toLocaleString()}</>
                    )}
                    {e.contactId && <> · Contact {e.contactId.slice(0, 8)}</>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {e.status === "WAITING" && (
                    <form action={resumeWorkflowEnrollment}>
                      <input type="hidden" name="enrollmentId" value={e.id} />
                      <input type="hidden" name="automationId" value={automationId} />
                      <SubmitButton
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-background transition"
                        pendingText="Resuming…"
                      >
                        Resume now
                      </SubmitButton>
                    </form>
                  )}
                  <form action={cancelWorkflowEnrollment}>
                    <input type="hidden" name="enrollmentId" value={e.id} />
                    <input type="hidden" name="automationId" value={automationId} />
                    <SubmitButton
                      className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                      pendingText="Cancelling…"
                    >
                      Cancel
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Run list */}
      {runs.length === 0 && !dbUnavailable ? (
        <Card><CardBody>
          <div className="py-10 text-center">
            <History size={28} className="mx-auto mb-3 text-muted" />
            <p className="font-medium">No runs yet</p>
            <p className="mt-1 text-sm text-muted">Test or publish the workflow to start seeing runs.</p>
          </div>
        </CardBody></Card>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <RunRow key={run.id} run={run} automationId={automationId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────

function RunRow({ run, automationId }: { run: RunWithSteps; automationId: string }) {
  const completed = run.stepRuns.filter((s) => s.status === "COMPLETED").length;
  const failed = run.stepRuns.filter((s) => s.status === "FAILED").length;
  const total = run.stepRuns.length;

  return (
    <Card>
      <div className="px-5 py-3">
        <div className="flex items-start gap-3">
          <RunStatusIcon status={run.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold font-mono text-muted">
                {run.id.slice(0, 8)}
              </span>
              <RunBadge status={run.status} />
              <span className="text-xs text-muted capitalize">
                {run.triggerType.replace(/_/g, " ").toLowerCase()}
              </span>
              {run.contactId && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <UserCheck size={10} /> {run.contactId.slice(0, 8)}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
              <span>{new Date(run.startedAt).toLocaleString()}</span>
              {run.completedAt && (
                <span>
                  {Math.round((run.completedAt.getTime() - run.startedAt.getTime()) / 1000)}s
                </span>
              )}
              {total > 0 && (
                <span>
                  {completed}/{total} steps
                  {failed > 0 && <span className="text-red-500"> · {failed} failed</span>}
                </span>
              )}
            </div>
            {run.error && (
              <p className="mt-1 text-xs text-red-600 truncate">{run.error}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {run.status === "FAILED" && (
              <form action={retryWorkflowRun}>
                <input type="hidden" name="runId" value={run.id} />
                <input type="hidden" name="automationId" value={automationId} />
                <SubmitButton
                  className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-background transition"
                  pendingText="Retrying…"
                >
                  <RefreshCw size={11} /> Retry
                </SubmitButton>
              </form>
            )}
            <Link
              href={`/automations/${automationId}/runs/${run.id}`}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-background transition"
            >
              Details
            </Link>
          </div>
        </div>

        {/* Step timeline (collapsed when no steps) */}
        {run.stepRuns.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-border pt-3">
            {run.stepRuns.map((step, i) => (
              <div key={step.id} className="flex items-center gap-2 text-xs">
                <span className="shrink-0 text-muted w-4 text-right">{i + 1}</span>
                <StepStatusDot status={step.status} />
                <span className="flex-1 truncate text-muted">
                  {step.stepName || step.stepType}
                </span>
                <span
                  className={`shrink-0 font-medium capitalize ${
                    step.status === "COMPLETED" ? "text-emerald-600" :
                    step.status === "FAILED" ? "text-red-600" :
                    step.status === "SKIPPED" ? "text-muted" :
                    step.status === "WAITING" ? "text-amber-600" :
                    "text-muted"
                  }`}
                >
                  {step.status.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function RunStatusIcon({ status }: { status: string }) {
  if (status === "COMPLETED") return <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />;
  if (status === "FAILED") return <XCircle size={16} className="mt-0.5 shrink-0 text-red-500" />;
  if (status === "WAITING") return <Clock size={16} className="mt-0.5 shrink-0 text-amber-500" />;
  if (status === "RUNNING") return <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-primary" />;
  if (status === "CANCELLED") return <XCircle size={16} className="mt-0.5 shrink-0 text-muted" />;
  return <AlertTriangle size={16} className="mt-0.5 shrink-0 text-muted" />;
}

function RunBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: "bg-emerald-100 text-emerald-700",
    FAILED: "bg-red-100 text-red-700",
    WAITING: "bg-amber-100 text-amber-700",
    RUNNING: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-gray-100 text-gray-600",
    QUEUED: "bg-gray-100 text-gray-600",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status.toLowerCase()}
    </span>
  );
}

function EnrollmentStatusIcon({ status }: { status: string }) {
  if (status === "WAITING") return <Clock size={16} className="shrink-0 text-amber-500" />;
  if (status === "ACTIVE") return <Loader2 size={16} className="shrink-0 animate-spin text-primary" />;
  return <AlertTriangle size={16} className="shrink-0 text-muted" />;
}

function EnrollmentBadge({ status }: { status: string }) {
  const cls =
    status === "WAITING" ? "bg-amber-100 text-amber-700" :
    status === "ACTIVE" ? "bg-blue-100 text-blue-700" :
    "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status.toLowerCase()}
    </span>
  );
}

function StepStatusDot({ status }: { status: string }) {
  const cls =
    status === "COMPLETED" ? "bg-emerald-400" :
    status === "FAILED" ? "bg-red-500" :
    status === "WAITING" ? "bg-amber-400" :
    status === "SKIPPED" ? "bg-gray-300" :
    "bg-gray-300";
  return <span className={`size-1.5 shrink-0 rounded-full ${cls}`} />;
}
