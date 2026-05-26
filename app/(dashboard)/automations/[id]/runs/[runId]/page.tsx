import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { retryWorkflowRun } from "@/app/(dashboard)/automations/actions";
import { RunDetailClient } from "./_client";

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
    ? await prisma.contact
        .findUnique({
          where: { id: run.contactId },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
        .catch(() => null)
    : null;

  const durationMs =
    run.completedAt ? run.completedAt.getTime() - run.startedAt.getTime() : null;

  // Serialise dates before passing to client component
  const serialisedRun = {
    id: run.id,
    status: run.status,
    triggerType: run.triggerType,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    error: run.error ?? null,
    contactId: run.contactId ?? null,
    payload: run.payload as Record<string, unknown> | null,
    stepRuns: run.stepRuns.map((s) => ({
      id: s.id,
      stepId: s.stepId,
      stepType: s.stepType,
      stepName: s.stepName ?? null,
      status: s.status,
      input: s.input as Record<string, unknown>,
      output: s.output as Record<string, unknown> | null,
      error: s.error as Record<string, unknown> | null,
      startedAt: s.startedAt?.toISOString() ?? null,
      endedAt: s.endedAt?.toISOString() ?? null,
    })),
  };

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

      {/* Meta cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <div className="text-xs text-muted mb-0.5">Trigger</div>
            <div className="font-semibold capitalize text-sm">
              {run.triggerType.replace(/_/g, " ").toLowerCase()}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-muted mb-0.5">Started</div>
            <div className="font-semibold text-sm">{new Date(run.startedAt).toLocaleString()}</div>
            {durationMs !== null && (
              <div className="text-xs text-muted">
                {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs text-muted mb-0.5">Contact</div>
            {contact ? (
              <Link
                href={`/contacts/${contact.id}`}
                className="font-semibold text-sm text-primary hover:underline"
              >
                {contact.firstName} {contact.lastName ?? ""}
              </Link>
            ) : (
              <div className="text-sm text-muted">
                {run.contactId ? run.contactId.slice(0, 8) : "—"}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Top-level error */}
      {run.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-semibold text-red-700 mb-0.5">Run failed</p>
          <p className="text-sm text-red-600 whitespace-pre-wrap break-words">{run.error}</p>
        </div>
      )}

      {/* Retry action */}
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

      {/* Step timeline + payload — client component for collapsible JSON */}
      <RunDetailClient run={serialisedRun} />
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function RunBadge({ status }: { status: string }) {
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
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status.toLowerCase()}
    </span>
  );
}
