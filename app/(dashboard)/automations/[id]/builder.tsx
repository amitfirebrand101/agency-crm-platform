"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  GripVertical,
  History,
  Play,
  Plus,
  Save,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  actionCatalog,
  getActionDef,
  getActionsByCategory,
  getTriggerDef,
  getTriggersByCategory,
  triggerCatalog,
} from "@/lib/automations/catalog";
import type { ActionDef, ConfigField, TriggerDef } from "@/lib/automations/catalog";
import { parseAutomationDefinition } from "@/lib/automations/types";
import type { AutomationDefinition, AutomationStep, AutomationTrigger } from "@/lib/automations/types";
import { validateDefinition } from "@/lib/automations/schema";
import { renameWorkflow, saveDefinition } from "./actions";
import { deleteWorkflow, publishWorkflow, runTestWorkflow, unpublishWorkflow } from "../actions";

type PanelState =
  | { mode: "add-trigger" }
  | { mode: "add-step"; insertAt: number; branchParentId?: string; branchKey?: "trueBranch" | "falseBranch" }
  | { mode: "config-trigger"; id: string }
  | { mode: "config-step"; id: string }
  | null;

type BuilderProps = {
  automation: {
    id: string;
    name: string;
    status: string;
    definition: unknown;
  };
  contacts: Array<{ id: string; firstName: string; lastName: string | null; email: string | null }>;
  appUrl: string;
};

export function WorkflowBuilder({ automation, contacts, appUrl }: BuilderProps) {
  const [definition, setDefinition] = useState<AutomationDefinition>(() =>
    parseAutomationDefinition(automation.definition)
  );
  const [name, setName] = useState(automation.name);
  const [status, setStatus] = useState(automation.status);
  const [panel, setPanel] = useState<PanelState>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  // ── Unsaved-changes guard ─────────────────────────────────────────────────
  // Warn the browser before unload when there are pending changes. This is
  // intentionally a no-op on Next.js client-side navigation (which doesn't
  // fire beforeunload); the amber warning bar below handles that case visually.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Required for legacy browser compat — the string value is ignored by
      // modern browsers but the assignment itself triggers the native dialog.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const runValidation = useCallback(() => {
    const { errors } = validateDefinition(definition);
    setValidationErrors(errors);
    return errors;
  }, [definition]);

  const mutate = useCallback((updater: (prev: AutomationDefinition) => AutomationDefinition) => {
    setDefinition(updater);
    setDirty(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentName = nameRef.current?.value?.trim() || name;
      await saveDefinition(automation.id, definition);
      if (currentName !== automation.name) await renameWorkflow(automation.id, currentName);
      setDirty(false);
      setSavedAt(new Date());
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (status !== "published") {
      const errors = runValidation();
      if (errors.length > 0) return; // validation panel shows errors
    }
    if (dirty) await handleSave();
    const fd = new FormData();
    fd.set("automationId", automation.id);
    startTransition(async () => {
      try {
        if (status === "published") {
          await unpublishWorkflow(fd);
          setStatus("draft");
        } else {
          await publishWorkflow(fd);
          setStatus("published");
          setValidationErrors([]);
        }
      } catch (err) {
        alert(String(err instanceof Error ? err.message : err));
      }
    });
  };

  // Trigger operations
  const addTrigger = (def: TriggerDef) => {
    const id = crypto.randomUUID();
    const newTrigger: AutomationTrigger = {
      id,
      type: def.type as AutomationTrigger["type"],
      name: def.label,
      config: def.type === "INBOUND_WEBHOOK" ? { token: crypto.randomUUID() } : {},
    };
    mutate((prev) => ({ ...prev, triggers: [...prev.triggers, newTrigger] }));
    setPanel({ mode: "config-trigger", id });
  };

  const removeTrigger = (id: string) => {
    mutate((prev) => ({ ...prev, triggers: prev.triggers.filter((t) => t.id !== id) }));
    if (panel?.mode === "config-trigger" && panel.id === id) setPanel(null);
  };

  const updateTriggerConfig = (id: string, patch: Record<string, string>) => {
    mutate((prev) => ({
      ...prev,
      triggers: prev.triggers.map((t) => (t.id === id ? { ...t, config: { ...t.config, ...patch } } : t)),
    }));
  };

  const updateTriggerLabel = (id: string, label: string) => {
    mutate((prev) => ({
      ...prev,
      triggers: prev.triggers.map((t) => (t.id === id ? { ...t, name: label } : t)),
    }));
  };

  const mapSteps = (
    steps: AutomationStep[],
    mapper: (step: AutomationStep) => AutomationStep | null
  ): AutomationStep[] => {
    return steps.flatMap((step) => {
      const mapped = mapper(step);
      if (!mapped) return [];
      return [{
        ...mapped,
        trueBranch: mapped.trueBranch ? mapSteps(mapped.trueBranch as AutomationStep[], mapper) : mapped.trueBranch,
        falseBranch: mapped.falseBranch ? mapSteps(mapped.falseBranch as AutomationStep[], mapper) : mapped.falseBranch,
      }];
    });
  };

  const findStep = (steps: AutomationStep[], id: string): AutomationStep | null => {
    for (const step of steps) {
      if (step.id === id) return step;
      const foundTrue = findStep((step.trueBranch ?? []) as AutomationStep[], id);
      if (foundTrue) return foundTrue;
      const foundFalse = findStep((step.falseBranch ?? []) as AutomationStep[], id);
      if (foundFalse) return foundFalse;
    }
    return null;
  };

  // Step operations
  const addStep = (
    def: ActionDef,
    insertAt: number,
    branchParentId?: string,
    branchKey?: "trueBranch" | "falseBranch"
  ) => {
    const id = crypto.randomUUID();
    const newStep: AutomationStep = { id, type: def.type as AutomationStep["type"], name: def.label, config: {} };
    mutate((prev) => {
      if (branchParentId && branchKey) {
        return {
          ...prev,
          steps: mapSteps(prev.steps, (step) => {
            if (step.id !== branchParentId) return step;
            const branch = [...((step[branchKey] ?? []) as AutomationStep[])];
            branch.splice(insertAt, 0, newStep);
            return { ...step, [branchKey]: branch };
          }),
        };
      }
      const steps = [...prev.steps];
      steps.splice(insertAt, 0, newStep);
      return { ...prev, steps };
    });
    setPanel({ mode: "config-step", id });
  };

  const removeStep = (id: string) => {
    mutate((prev) => ({ ...prev, steps: mapSteps(prev.steps, (s) => (s.id === id ? null : s)) }));
    if (panel?.mode === "config-step" && panel.id === id) setPanel(null);
  };

  const updateStepConfig = (id: string, patch: Record<string, string>) => {
    mutate((prev) => ({
      ...prev,
      steps: mapSteps(prev.steps, (s) => (s.id === id ? { ...s, config: { ...s.config, ...patch } } : s)),
    }));
  };

  const updateStepLabel = (id: string, label: string) => {
    mutate((prev) => ({
      ...prev,
      steps: mapSteps(prev.steps, (s) => (s.id === id ? { ...s, name: label } : s)),
    }));
  };

  // Drag-to-reorder
  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== dragId) setDropId(id);
  };
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setDropId(null); return; }
    const fi = definition.steps.findIndex((s) => s.id === dragId);
    const ti = definition.steps.findIndex((s) => s.id === targetId);
    if (fi === -1 || ti === -1) return;
    const steps = [...definition.steps];
    const [moved] = steps.splice(fi, 1);
    steps.splice(ti, 0, moved);
    mutate((prev) => ({ ...prev, steps }));
    setDragId(null);
    setDropId(null);
  };
  const onDragEnd = () => { setDragId(null); setDropId(null); };

  const selectedTrigger = panel?.mode === "config-trigger" ? definition.triggers.find((t) => t.id === panel.id) : null;
  const selectedStep = panel?.mode === "config-step" ? findStep(definition.steps, panel.id) : null;

  const renderStep = (step: AutomationStep, index: number, options?: { nested?: boolean }) => {
    const nested = options?.nested ?? false;
    return (
      <div className="w-full" key={step.id}>
        <StepCard
          active={panel?.mode === "config-step" && panel.id === step.id}
          dragging={!nested && dragId === step.id}
          dropTarget={!nested && dropId === step.id}
          index={index}
          nested={nested}
          onClick={() => setPanel({ mode: "config-step", id: step.id })}
          onDragEnd={onDragEnd}
          onDragOver={(e) => !nested && onDragOver(e, step.id)}
          onDragStart={() => !nested && onDragStart(step.id)}
          onDrop={() => !nested && onDrop(step.id)}
          onRemove={() => removeStep(step.id)}
          step={step}
        />
        {step.type === "IF_ELSE" ? (
          <BranchGrid
            falseBranch={(step.falseBranch ?? []) as AutomationStep[]}
            onAddFalse={(insertAt) => setPanel({ mode: "add-step", insertAt, branchParentId: step.id, branchKey: "falseBranch" })}
            onAddTrue={(insertAt) => setPanel({ mode: "add-step", insertAt, branchParentId: step.id, branchKey: "trueBranch" })}
            renderStep={(branchStep, branchIndex) => renderStep(branchStep, branchIndex, { nested: true })}
            trueBranch={(step.trueBranch ?? []) as AutomationStep[]}
          />
        ) : null}
        {!nested ? <Connector onAdd={() => setPanel({ mode: "add-step", insertAt: index + 1 })} /> : null}
      </div>
    );
  };

  return (
    <div className="-mx-5 -my-6 lg:-mx-8 flex flex-col" style={{ height: "calc(100vh - 61px)" }}>

      {/* ─── Top Bar ─────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-panel px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-background hover:text-foreground transition"
            href="/automations"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Workflows</span>
          </Link>
          <span className="text-border">/</span>
          <input
            ref={nameRef}
            className="min-w-0 max-w-xs truncate rounded-md bg-transparent px-2 py-1 text-sm font-semibold focus:bg-background focus:outline-none focus:ring-1 focus:ring-border"
            defaultValue={name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== name) { setName(v); setDirty(true); }
            }}
          />
          <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold sm:inline ${status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-muted/20 text-muted"}`}>
            {status === "published" ? "Published" : "Draft"}
          </span>
          {savedAt && !dirty ? (
            <span className="hidden shrink-0 items-center gap-1 text-xs text-muted lg:flex">
              <CheckCircle2 size={11} />
              Saved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/automations/${automation.id}/runs`}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted hover:bg-background hover:text-foreground transition"
          >
            <History size={12} />
            <span className="hidden sm:inline">Runs</span>
          </Link>
          <form action={runTestWorkflow}>
            <input name="automationId" type="hidden" value={automation.id} />
            <input name="contactId" type="hidden" value={contacts[0]?.id ?? ""} />
            <button
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background transition"
              title="Test run with first contact"
              type="submit"
            >
              <Play size={12} />
              Test
            </button>
          </form>
          <button
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background transition disabled:opacity-40"
            disabled={!dirty || saving}
            onClick={handleSave}
            type="button"
          >
            <Save size={12} />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              status === "published"
                ? "border border-border bg-background text-foreground hover:bg-muted/10"
                : "bg-primary text-white hover:opacity-90"
            }`}
            disabled={isPending || saving}
            onClick={handlePublish}
            type="button"
          >
            {isPending ? "…" : status === "published" ? "Unpublish" : "Publish"}
          </button>
          <form action={deleteWorkflow}>
            <input name="automationId" type="hidden" value={automation.id} />
            <button
              className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-sm text-red-600 hover:bg-red-50 transition"
              title="Delete workflow"
              type="submit"
            >
              <Trash2 size={13} />
            </button>
          </form>
        </div>
      </div>

      {/* ─── Unsaved-changes warning bar ─────────────────────────────── */}
      {dirty && (
        <div className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-amber-600" />
            <p className="flex-1 text-xs font-semibold text-amber-700">
              You have unsaved changes. Save before leaving.
            </p>
            <button
              className="shrink-0 flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition disabled:opacity-50"
              disabled={saving}
              onClick={handleSave}
              type="button"
            >
              <Save size={11} />
              {saving ? "Saving…" : "Save now"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Validation banner ───────────────────────────────────────── */}
      {validationErrors.length > 0 && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-700">Fix before publishing</p>
              <ul className="mt-0.5 list-disc list-inside space-y-0.5">
                {validationErrors.slice(0, 3).map((e, i) => (
                  <li key={i} className="text-xs text-amber-700">{e}</li>
                ))}
                {validationErrors.length > 3 && (
                  <li className="text-xs text-amber-700">…and {validationErrors.length - 3} more</li>
                )}
              </ul>
            </div>
            <button onClick={() => setValidationErrors([])} className="shrink-0 text-amber-500 hover:text-amber-700" type="button">
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Area ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] px-6 py-10">
          <div className="mx-auto flex flex-col items-center" style={{ maxWidth: 580 }}>

            {/* Trigger section */}
            {definition.triggers.length === 0 ? (
              <button
                className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-white px-6 py-10 shadow-sm hover:border-primary hover:shadow-md transition"
                onClick={() => setPanel({ mode: "add-trigger" })}
                type="button"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Zap size={20} />
                </span>
                <div className="text-left">
                  <div className="font-semibold text-foreground">Add a Trigger</div>
                  <div className="text-sm text-muted">Choose what starts this workflow</div>
                </div>
              </button>
            ) : (
              <div className="w-full space-y-2">
                {definition.triggers.map((trigger) => (
                  <TriggerCard
                    active={panel?.mode === "config-trigger" && panel.id === trigger.id}
                    appUrl={appUrl}
                    automationId={automation.id}
                    key={trigger.id}
                    onClick={() => setPanel({ mode: "config-trigger", id: trigger.id })}
                    onRemove={() => removeTrigger(trigger.id)}
                    trigger={trigger}
                  />
                ))}
                <button
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-white/60 px-3 py-2 text-xs text-muted hover:border-primary hover:text-primary transition"
                  onClick={() => setPanel({ mode: "add-trigger" })}
                  type="button"
                >
                  <Plus size={12} />
                  Add another trigger
                </button>
              </div>
            )}

            {/* Steps */}
            {(definition.triggers.length > 0 || definition.steps.length > 0) && (
              <>
                <Connector onAdd={() => setPanel({ mode: "add-step", insertAt: 0 })} />
                {definition.steps.map((step, index) => renderStep(step, index))}
              </>
            )}
          </div>
        </div>

        {/* Right Panel */}
        {panel ? (
          <aside className="w-96 shrink-0 overflow-y-auto border-l border-border bg-panel">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">
                {panel.mode === "add-trigger" && "Choose Trigger"}
                {panel.mode === "add-step" && "Add Action"}
                {panel.mode === "config-trigger" && "Configure Trigger"}
                {panel.mode === "config-step" && "Configure Action"}
              </h3>
              <button
                className="rounded-md p-1 text-muted hover:bg-background hover:text-foreground transition"
                onClick={() => setPanel(null)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            {panel.mode === "add-trigger" && (
              <NodePicker
                items={triggerCatalog}
                onSelect={(def) => addTrigger(def as TriggerDef)}
                type="trigger"
              />
            )}
            {panel.mode === "add-step" && (
              <NodePicker
                items={actionCatalog}
                onSelect={(def) => addStep(def as ActionDef, panel.insertAt, panel.branchParentId, panel.branchKey)}
                type="action"
              />
            )}
            {panel.mode === "config-trigger" && selectedTrigger && (
              <ConfigForm
                appUrl={appUrl}
                automationId={automation.id}
                config={selectedTrigger.config as Record<string, string>}
                configFields={getTriggerDef(selectedTrigger.type)?.configFields}
                label={selectedTrigger.name}
                nodeType="trigger"
                onConfigChange={(patch) => updateTriggerConfig(selectedTrigger.id, patch)}
                onLabelChange={(label) => updateTriggerLabel(selectedTrigger.id, label)}
                type={selectedTrigger.type}
              />
            )}
            {panel.mode === "config-step" && selectedStep && (
              <ConfigForm
                appUrl={appUrl}
                automationId={automation.id}
                config={selectedStep.config as Record<string, string>}
                configFields={getActionDef(selectedStep.type)?.configFields}
                label={selectedStep.name}
                nodeType="step"
                onConfigChange={(patch) => updateStepConfig(selectedStep.id, patch)}
                onLabelChange={(label) => updateStepLabel(selectedStep.id, label)}
                type={selectedStep.type}
              />
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

// ─── TriggerCard ─────────────────────────────────────────────────────────────

type TriggerCardProps = {
  trigger: AutomationTrigger;
  active: boolean;
  appUrl: string;
  automationId: string;
  onClick: () => void;
  onRemove: () => void;
};

function TriggerCard({ trigger, active, appUrl, automationId, onClick, onRemove }: TriggerCardProps) {
  const def = getTriggerDef(trigger.type);
  const Icon = def?.icon ?? Zap;
  const webhookUrl =
    trigger.type === "INBOUND_WEBHOOK" && trigger.config.token
      ? `${appUrl}/api/workflows/${automationId}/webhook?token=${trigger.config.token}`
      : null;

  const configSummary = Object.entries(trigger.config)
    .filter(([k]) => k !== "token")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

  return (
    <div
      className={`cursor-pointer overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition ${
        active ? "border-primary shadow-md" : "border-transparent hover:border-primary/40 hover:shadow-md"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3 bg-primary/8 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
          <Icon size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary/70">{def?.category ?? "Trigger"}</div>
          <div className="font-semibold text-sm text-foreground leading-tight">{trigger.name}</div>
        </div>
        <button
          className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove trigger"
          type="button"
        >
          <X size={14} />
        </button>
      </div>
      <div className="px-4 py-2.5">
        {configSummary ? (
          <p className="text-xs text-muted">{configSummary}</p>
        ) : webhookUrl ? (
          <p className="truncate font-mono text-xs text-muted">{webhookUrl}</p>
        ) : (
          <p className="text-xs italic text-muted/60">Click to configure</p>
        )}
      </div>
    </div>
  );
}

// ─── StepCard ────────────────────────────────────────────────────────────────

type StepCardProps = {
  step: AutomationStep;
  index: number;
  active: boolean;
  dragging: boolean;
  dropTarget: boolean;
  nested?: boolean;
  onClick: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
};

function StepCard({ step, index, active, dragging, dropTarget, nested = false, onClick, onRemove, onDragStart, onDragOver, onDrop, onDragEnd }: StepCardProps) {
  const def = getActionDef(step.type);
  const Icon = def?.icon ?? Zap;
  const color = def?.color ?? "bg-slate-500";
  const colorLight = def?.colorLight ?? "bg-slate-100";

  const configSummary = Object.entries(step.config)
    .slice(0, 2)
    .map(([k, v]) => (v ? `${k}: ${v}` : null))
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`cursor-pointer overflow-hidden rounded-2xl border-2 bg-white shadow-sm transition ${
        dragging ? "opacity-30 scale-95" : ""
      } ${
        dropTarget ? "border-primary scale-[1.01] shadow-lg" :
        active ? "border-primary shadow-md" :
        "border-transparent hover:border-primary/40 hover:shadow-md"
      }`}
      draggable={!nested}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      onClick={onClick}
    >
      <div className={`flex items-start gap-3 ${colorLight} px-4 py-3`}>
        {!nested ? (
          <button
            className="mt-0.5 cursor-grab shrink-0 rounded-md p-1 text-muted/60 hover:text-muted transition active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            title="Drag to reorder"
            type="button"
          >
            <GripVertical size={14} />
          </button>
        ) : null}
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${color} text-white shadow-sm`}>
          <Icon size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted">{def?.category ?? "Action"}</div>
          <div className="font-semibold text-sm text-foreground leading-tight">{step.name}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="rounded-md bg-white/60 px-1.5 py-0.5 text-[10px] font-bold text-muted">{index + 1}</span>
          <button
            className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Remove step"
            type="button"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="px-4 py-2.5">
        {configSummary ? (
          <p className="text-xs text-muted">{configSummary}</p>
        ) : (
          <p className="text-xs italic text-muted/60">Click to configure</p>
        )}
      </div>
    </div>
  );
}

function BranchGrid({
  trueBranch,
  falseBranch,
  onAddTrue,
  onAddFalse,
  renderStep,
}: {
  trueBranch: AutomationStep[];
  falseBranch: AutomationStep[];
  onAddTrue: (insertAt: number) => void;
  onAddFalse: (insertAt: number) => void;
  renderStep: (step: AutomationStep, index: number) => ReactNode;
}) {
  return (
    <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm md:grid-cols-2">
      <BranchColumn
        emptyText="Actions here run when the condition is true."
        label="Yes path"
        onAdd={onAddTrue}
        renderStep={renderStep}
        steps={trueBranch}
        tone="emerald"
      />
      <BranchColumn
        emptyText="Actions here run when no condition is matched."
        label="No path"
        onAdd={onAddFalse}
        renderStep={renderStep}
        steps={falseBranch}
        tone="slate"
      />
    </div>
  );
}

function BranchColumn({
  label,
  tone,
  steps,
  emptyText,
  onAdd,
  renderStep,
}: {
  label: string;
  tone: "emerald" | "slate";
  steps: AutomationStep[];
  emptyText: string;
  onAdd: (insertAt: number) => void;
  renderStep: (step: AutomationStep, index: number) => ReactNode;
}) {
  const badgeClass =
    tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700";
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background/50 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-widest ${badgeClass}`}>
          {label}
        </span>
        <button
          className="rounded-md border border-border bg-white px-2 py-1 text-xs font-medium hover:bg-panel"
          onClick={() => onAdd(steps.length)}
          type="button"
        >
          Add
        </button>
      </div>
      {steps.length > 0 ? (
        <div className="space-y-2">{steps.map((step, index) => renderStep(step, index))}</div>
      ) : (
        <button
          className="w-full rounded-lg border border-dashed border-border bg-white px-3 py-6 text-center text-xs text-muted hover:border-primary hover:text-primary"
          onClick={() => onAdd(0)}
          type="button"
        >
          {emptyText}
        </button>
      )}
    </div>
  );
}

// ─── Connector ───────────────────────────────────────────────────────────────

function Connector({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="h-5 w-px bg-border" />
      <button
        className="group flex size-7 items-center justify-center rounded-full border-2 border-border bg-white text-muted shadow-sm hover:border-primary hover:bg-primary hover:text-white transition"
        onClick={onAdd}
        title="Add action here"
        type="button"
      >
        <Plus size={13} />
      </button>
      <div className="h-5 w-px bg-border" />
    </div>
  );
}

// ─── NodePicker ──────────────────────────────────────────────────────────────

type NodePickerProps = {
  items: TriggerDef[] | ActionDef[];
  onSelect: (def: TriggerDef | ActionDef) => void;
  type: "trigger" | "action";
};

function NodePicker({ items, onSelect, type }: NodePickerProps) {
  const [search, setSearch] = useState("");
  const lower = search.toLowerCase();

  const filtered = search
    ? items.filter((i) => i.label.toLowerCase().includes(lower) || i.description.toLowerCase().includes(lower))
    : null;

  const grouped = filtered
    ? null
    : type === "trigger"
    ? getTriggersByCategory()
    : getActionsByCategory();

  const renderItem = (def: TriggerDef | ActionDef) => {
    const Icon = def.icon;
    const isAction = "color" in def;
    return (
      <button
        className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition ${
          def.executable ? "hover:bg-background" : "cursor-not-allowed opacity-55"
        }`}
        disabled={!def.executable}
        key={def.type}
        onClick={() => onSelect(def)}
        type="button"
      >
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-white ${
            isAction ? (def as ActionDef).color : "bg-primary"
          }`}
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium leading-tight">
            {def.label}
            {!def.executable ? (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">soon</span>
            ) : null}
          </div>
          <div className="mt-0.5 text-xs text-muted">{def.description}</div>
        </div>
      </button>
    );
  };

  return (
    <div className="p-3">
      <input
        autoFocus
        className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${type === "trigger" ? "triggers" : "actions"}…`}
        type="text"
        value={search}
      />
      {filtered ? (
        <div className="space-y-0.5">
          {filtered.map(renderItem)}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">No results for &ldquo;{search}&rdquo;</p>
          )}
        </div>
      ) : (
        grouped &&
        Object.entries(grouped).map(([category, defs]) => (
          <div className="mb-3" key={category}>
            <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-muted">{category}</div>
            <div className="space-y-0.5">{(defs as (TriggerDef | ActionDef)[]).map(renderItem)}</div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── ConfigForm ──────────────────────────────────────────────────────────────

type ConfigFormProps = {
  nodeType: "trigger" | "step";
  type: string;
  label: string;
  config: Record<string, string>;
  configFields?: ConfigField[];
  appUrl: string;
  automationId: string;
  onConfigChange: (patch: Record<string, string>) => void;
  onLabelChange: (label: string) => void;
};

function ConfigForm({ nodeType, type, label, config, configFields, appUrl, automationId, onConfigChange, onLabelChange }: ConfigFormProps) {
  const webhookUrl =
    type === "INBOUND_WEBHOOK" && config.token
      ? `${appUrl}/api/workflows/${automationId}/webhook?token=${config.token}`
      : null;

  return (
    <div className="space-y-4 p-4">
      {/* Step name */}
      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
          {nodeType === "trigger" ? "Trigger Name" : "Step Name"}
        </label>
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          defaultValue={label}
          onBlur={(e) => { if (e.target.value.trim()) onLabelChange(e.target.value.trim()); }}
          type="text"
        />
      </div>

      {/* Webhook URL */}
      {webhookUrl ? (
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Webhook URL</label>
          <div className="flex items-center gap-2 overflow-hidden rounded-xl border border-border bg-background px-3 py-2">
            <code className="flex-1 truncate text-xs text-muted">{webhookUrl}</code>
            <button
              className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
              type="button"
            >
              Copy
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">POST JSON to this URL to trigger the workflow.</p>
        </div>
      ) : null}

      {/* Config fields */}
      {configFields?.map((field) => (
        <div key={field.key}>
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
            {field.label}
            {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
          </label>
          {field.type === "select" ? (
            <select
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              defaultValue={config[field.key] ?? ""}
              onChange={(e) => onConfigChange({ [field.key]: e.target.value })}
            >
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              defaultValue={config[field.key] ?? ""}
              onBlur={(e) => onConfigChange({ [field.key]: e.target.value })}
              placeholder={field.placeholder}
              rows={3}
            />
          ) : (
            <input
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              defaultValue={config[field.key] ?? ""}
              onBlur={(e) => onConfigChange({ [field.key]: e.target.value })}
              placeholder={field.placeholder}
              type={field.type === "number" ? "number" : "text"}
            />
          )}
        </div>
      ))}

      {!configFields?.length && !webhookUrl ? (
        <p className="text-sm text-muted">This {nodeType} has no configurable settings.</p>
      ) : null}
    </div>
  );
}
