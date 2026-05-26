"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

// ── Types ─────────────────────────────────────────────────────────────────────

type StepRun = {
  id: string;
  stepId: string;
  stepType: string;
  stepName: string | null;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  startedAt: string | null;
  endedAt: string | null;
};

type RunDetail = {
  id: string;
  status: string;
  triggerType: string;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  contactId: string | null;
  payload: Record<string, unknown> | null;
  stepRuns: StepRun[];
};

// ── Root component ────────────────────────────────────────────────────────────

export function RunDetailClient({ run }: { run: RunDetail }) {
  return (
    <div className="space-y-6">
      {/* Step execution log */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-sm">Step Execution Log</h2>
          <span className="text-xs text-muted">{run.stepRuns.length} step{run.stepRuns.length !== 1 ? "s" : ""}</span>
        </CardHeader>
        {run.stepRuns.length === 0 ? (
          <CardBody>
            <p className="text-sm text-muted">No step records for this run.</p>
          </CardBody>
        ) : (
          <div className="divide-y divide-border">
            {run.stepRuns.map((step, idx) => (
              <StepRunRow key={step.id} step={step} index={idx} />
            ))}
          </div>
        )}
      </Card>

      {/* Trigger payload */}
      {run.payload && Object.keys(run.payload).length > 0 && (
        <CollapsibleJsonCard
          title="Trigger Context"
          subtitle="Payload that started this run"
          data={run.payload}
          defaultExpanded={false}
        />
      )}
    </div>
  );
}

// ── StepRunRow ────────────────────────────────────────────────────────────────

function StepRunRow({ step, index }: { step: StepRun; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const hasInput = step.input && Object.keys(step.input).length > 0;
  const hasOutput = step.output && Object.keys(step.output).length > 0;
  const hasError = step.error && Object.keys(step.error).length > 0;

  const durationMs =
    step.startedAt && step.endedAt
      ? new Date(step.endedAt).getTime() - new Date(step.startedAt).getTime()
      : null;

  return (
    <div className="px-5 py-3">
      <div
        className={`flex items-start gap-3 ${hasInput || hasOutput || hasError ? "cursor-pointer" : ""}`}
        onClick={() => (hasInput || hasOutput || hasError) && setExpanded((v) => !v)}
        role={hasInput || hasOutput || hasError ? "button" : undefined}
        tabIndex={hasInput || hasOutput || hasError ? 0 : undefined}
        onKeyDown={(e) => {
          if ((hasInput || hasOutput || hasError) && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <span className="mt-0.5 w-5 shrink-0 text-center text-xs font-bold text-muted">{index + 1}</span>
        <StepStatusIcon status={step.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{step.stepName || step.stepType}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 uppercase">
              {step.stepType}
            </span>
            <StepBadge status={step.status} />
            {durationMs !== null && (
              <span className="text-xs text-muted">
                {durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
          {/* Error message inline preview */}
          {hasError && step.error?.message != null && (
            <p className="mt-0.5 text-xs text-red-600 truncate">{String(step.error.message)}</p>
          )}
        </div>
        {/* Expand toggle */}
        {(hasInput || hasOutput || hasError) && (
          <button
            className="ml-1 shrink-0 rounded-md p-1 text-muted hover:bg-background hover:text-foreground transition"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            title={expanded ? "Collapse" : "Expand details"}
            type="button"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 ml-8 space-y-3">
          {hasInput && (
            <JsonBlock label="Input" data={step.input} />
          )}
          {hasOutput && step.output && (
            <JsonBlock label="Output" data={step.output} />
          )}
          {hasError && step.error && (
            <JsonBlock label="Error" data={step.error} variant="error" />
          )}
        </div>
      )}
    </div>
  );
}

// ── CollapsibleJsonCard ───────────────────────────────────────────────────────

function CollapsibleJsonCard({
  title,
  subtitle,
  data,
  defaultExpanded = false,
}: {
  title: string;
  subtitle?: string;
  data: Record<string, unknown>;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card>
      <button
        className="w-full"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
            <h2 className="font-semibold text-sm">{title}</h2>
            {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
          </div>
        </CardHeader>
      </button>
      {expanded && (
        <CardBody>
          <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto leading-relaxed">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CardBody>
      )}
    </Card>
  );
}

// ── JsonBlock ─────────────────────────────────────────────────────────────────

function JsonBlock({
  label,
  data,
  variant = "default",
}: {
  label: string;
  data: Record<string, unknown>;
  variant?: "default" | "error";
}) {
  return (
    <div>
      <p
        className={`mb-1 text-[10px] font-bold uppercase tracking-widest ${
          variant === "error" ? "text-red-600" : "text-muted"
        }`}
      >
        {label}
      </p>
      <pre
        className={`text-xs bg-gray-50 p-2 rounded overflow-x-auto leading-relaxed ${
          variant === "error" ? "border border-red-200 bg-red-50 text-red-800" : ""
        }`}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: string }) {
  if (status === "COMPLETED")
    return <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />;
  if (status === "FAILED")
    return <XCircle size={15} className="mt-0.5 shrink-0 text-red-500" />;
  if (status === "WAITING")
    return <Clock size={15} className="mt-0.5 shrink-0 text-amber-500" />;
  if (status === "RUNNING")
    return <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin text-blue-500" />;
  return <AlertTriangle size={15} className="mt-0.5 shrink-0 text-muted" />;
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
