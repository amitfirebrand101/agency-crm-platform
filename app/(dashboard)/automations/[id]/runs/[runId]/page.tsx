import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Loader2,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { retryWorkflowRun } from "@/app/(dashboard)/automations/actions";

type PageProps = { params: Promise<{ id: string; runId: string }> };

export default async function RunDetailPage({ params }: PageProps) {
  const { id: automationId, runId } = await params;
  const user = await requireUser();

  const automation = await prisma.automation.findFirst({
    where: { id: automationId, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
    select: { id: true, name: true },
  });
  if (!automation) notFound();

  const run = await prisma.automationRun.findFirst({
    where: { id: runId, automationId, agencyId: user.agencyId },
    include: { stepRuns: { orderBy: { createdAt: "asc" } } },
  });
  if (!run) notFound();

  const contact = run.contactId
    ? await prisma.contact.findUnique({
        where: { id: run.contactId },
        select: { id: true, firstName: true, lastName: true, email: true },
      }).catch(() => null)
    : null;

  const durationMs = run.completedAt
    ? run.completedAt.getTime() - run.startedAt.getTime()
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/automations/${automationId}/runs`}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition"
        >
          <ArrowLeft size={14} /> Run History
        </Link>
        <span className="text-muted/40">/</span>
        <span className="font-mono text-sm text-muted">{run.id.slice(0, 8)}</span>
        <RunBadge status={run.status} />
      </div>

      {/* Meta */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardBody>
          <div className="text-xs text-muted mb-0.5">Trigger</div>
          <div className="font-semibold capitalize text-sm">{run.triggerType.replace(/_/g, " ").toLowerCase()}</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-muted mb-0.5">Started</div>
          <div className="font-semibold text-sm">{new Date(run.startedAt).toLocaleString()}</div>
          {durationMs !== null && (
            <div className="text-xs text-muted">{durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}</div>
          )}
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-xs text-muted mb-0.5">Contact</div>
          {contact ? (
            <Link href={`/contacts/${contact.id}`} className="font-semibold text-sm text-primary hover:underline">
              {contact.firstName} {contact.lastName ?? ""}
            </Link>
          ) : (
            <div className="text-sm text-muted">{run.contactId ? run.contactId.slice(0, 8) : "—"}</div>
          )}
        </CardBody></Card>
      </div>

      {/* Error */}
      {run.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-semibold text-red-700 mb-0.5">Run failed</p>
          <p className="text-sm text-red-600">{run.error}</p>
        </div>
      )}

      {/* Actions */}
      {run.status === "FAILED" && (
        <form action={retryWorkflowRun}>
          <input type="hidden" name="runId" value={run.id} />
          <input type="hidden" name="automationId" value={automationId} />
          <SubmitButton
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-background transition"
            pendingText="Retrying…"
          >
            <RefreshCw size={13} /> Retry this run
          </SubmitButton>
        </form>
      )}

      {/* Step timeline */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-sm">Step Timeline</h2>
          <span className="text-xs text-muted">{run.stepRuns.length} steps</span>
        </CardHeader>
        {run.stepRuns.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">No step records for this run.</p>
          </CardBody>
        ) : (
          <div className="divide-y divide-border">
            {run.stepRuns.map((step, idx) => {
              const output = step.output as Record<string, unknown> | null;
              const error = step.error as Record<string, unknown> | null;
              return (
                <div key={step.id} className="px-5 py-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-bold text-muted">{idx + 1}</span>
                    <StepStatusIcon status={step.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{step.stepName || step.stepType}</span>
                        <span className="text-xs text-muted font-mono uppercase">{step.stepType}</span>
                        <StepBadge status={step.status} />
                      </div>
                      {error?.message != null && (
                        <p className="mt-0.5 text-xs text-red-600">{String(error.message)}</p>
                      )}
                      {output && Object.keys(output).length > 0 && (
                        <div className="mt-1.5 rounded-md bg-background border border-border px-3 py-1.5">
                          <pre className="text-xs text-muted overflow-x-auto">
                            {JSON.stringify(output, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                    {step.endedAt && step.startedAt && (
                      <span className="shrink-0 text-xs text-muted">
                        {Math.round(
                          (new Date(step.endedAt).getTime() - new Date(step.startedAt).getTime())
                        )}ms
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Trigger payload */}
      {run.payload && (
        <Card>
          <CardHeader><h2 className="font-semibold text-sm">Trigger Payload</h2></CardHeader>
          <CardBody>
            <pre className="text-xs text-muted overflow-x-auto">
              {JSON.stringify(run.payload, null, 2)}
            </pre>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function RunBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: "bg-emerald-100 text-emerald-700",
    FAILED: "bg-red-100 text-red-700",
    WAITING: "bg-amber-100 text-amber-700",
    RUNNING: "bg-blue-100 text-blue-700",
    CANCELLED: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status.toLowerCase()}
    </span>
  );
}

function StepBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    COMPLETED: "text-emerald-600",
    FAILED: "text-red-600",
    SKIPPED: "text-muted",
    WAITING: "text-amber-600",
    RUNNING: "text-blue-600",
  };
  return (
    <span className={`text-xs font-medium capitalize ${map[status] ?? "text-muted"}`}>
      {status.toLowerCase()}
    </span>
  );
}

function StepStatusIcon({ status }: { status: string }) {
  if (status === "COMPLETED") return <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />;
  if (status === "FAILED") return <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />;
  if (status === "WAITING") return <Clock size={15} className="mt-0.5 shrink-0 text-amber-500" />;
  if (status === "RUNNING") return <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-blue-500" />;
  if (status === "SKIPPED") return <AlertTriangle size={15} className="mt-0.5 shrink-0 text-muted" />;
  return <AlertTriangle size={15} className="mt-0.5 shrink-0 text-muted" />;
}
