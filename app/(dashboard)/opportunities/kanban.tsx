"use client";

import { useState, useOptimistic, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Badge, statusVariant } from "@/components/ui/badge";
import { moveOpportunityToStage, updateOpportunityStatus } from "@/app/(dashboard)/module-actions";

type Stage = { id: string; name: string; position: number };
type Opportunity = {
  id: string;
  name: string;
  valueCents: number;
  status: string;
  stageId: string;
  createdAt: string;
  contact: { id: string; firstName: string; lastName: string | null } | null;
};

const AVATAR_COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ec4899","#06b6d4","#6366f1"];
function avatarBg(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length] ?? "#3b82f6";
}
function formatCents(c: number) {
  return "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function daysOld(createdAt: string) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
}

// ── Droppable stage column ────────────────────────────────────────────────────
function StageColumn({
  stage,
  opps,
  allStages,
  onStatusChange,
}: {
  stage: Stage;
  opps: Opportunity[];
  allStages: Stage[];
  onStatusChange: (opp: Opportunity, status: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const stageValue = opps.reduce((s, o) => s + o.valueCents, 0);

  return (
    <div className="w-72 shrink-0 flex flex-col">
      <div className="mb-3 flex items-center justify-between rounded-lg bg-background px-3 py-2.5 border border-border">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{stage.name}</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-bold text-primary">
            {opps.length}
          </span>
        </div>
        <span className="text-xs font-semibold text-muted">{formatCents(stageValue)}</span>
      </div>

      <div
        ref={setNodeRef}
        className={[
          "flex-1 space-y-3 rounded-xl p-1 min-h-20 transition-colors",
          isOver ? "bg-primary/5 ring-1 ring-primary/20" : "",
        ].join(" ")}
      >
        {opps.map((opp) => (
          <DraggableCard key={opp.id} opp={opp} allStages={allStages} onStatusChange={onStatusChange} />
        ))}
        {opps.length === 0 && !isOver && (
          <div className="rounded-xl border border-dashed border-border p-5 text-xs text-muted text-center">
            Drop deals here
          </div>
        )}
        <a
          href="#new-opportunity"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted hover:border-primary hover:text-primary transition"
        >
          <Plus size={14} />
          Add Deal
        </a>
      </div>
    </div>
  );
}

// ── Draggable deal card ───────────────────────────────────────────────────────
function DraggableCard({
  opp,
  allStages,
  onStatusChange,
  isDragOverlay = false,
}: {
  opp: Opportunity;
  allStages: Stage[];
  onStatusChange: (opp: Opportunity, status: string) => void;
  isDragOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: opp.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging && !isDragOverlay ? 0.3 : 1,
  };

  const contactName = opp.contact
    ? `${opp.contact.firstName} ${opp.contact.lastName ?? ""}`.trim()
    : null;
  const initials = contactName
    ? contactName.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "rounded-xl border border-border bg-white p-4 space-y-3 select-none",
        isDragOverlay ? "shadow-xl rotate-1 cursor-grabbing" : "shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab text-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <Link
            href={`/opportunities/${opp.id}`}
            className="block font-semibold text-sm leading-snug hover:text-primary transition-colors"
          >
            {opp.name}
          </Link>
        </div>
        <Badge variant={statusVariant(opp.status)} className="shrink-0 text-[10px]">
          {opp.status}
        </Badge>
      </div>

      {contactName && (
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
            style={{ backgroundColor: avatarBg(contactName) }}
          >
            {initials}
          </span>
          {opp.contact ? (
            <Link href={`/contacts/${opp.contact.id}`} className="text-xs text-muted hover:text-primary truncate">
              {contactName}
            </Link>
          ) : (
            <span className="text-xs text-muted truncate">{contactName}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="text-lg font-bold">{formatCents(opp.valueCents)}</span>
        <span className="text-[11px] text-muted">{daysOld(opp.createdAt)}d old</span>
      </div>

      {opp.status === "OPEN" && !isDragOverlay && (
        <div className="flex gap-1.5">
          <button
            onClick={() => onStatusChange(opp, "WON")}
            className="flex-1 flex items-center justify-center gap-1 rounded-md border border-green-200 bg-green-50 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 transition"
          >
            <TrendingUp size={11} /> Won
          </button>
          <button
            onClick={() => onStatusChange(opp, "LOST")}
            className="flex-1 flex items-center justify-center gap-1 rounded-md border border-red-200 bg-red-50 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
          >
            <TrendingDown size={11} /> Lost
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main kanban board ─────────────────────────────────────────────────────────
export function KanbanBoard({
  stages,
  initialOpportunities,
}: {
  stages: Stage[];
  initialOpportunities: Opportunity[];
}) {
  const [opps, setOpps] = useOptimistic(
    initialOpportunities,
    (state, { id, stageId }: { id: string; stageId: string }) =>
      state.map((o) => (o.id === id ? { ...o, stageId } : o))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const oppId = String(active.id);
    const newStageId = String(over.id);
    const opp = opps.find((o) => o.id === oppId);
    if (!opp || opp.stageId === newStageId) return;
    if (!stages.find((s) => s.id === newStageId)) return;

    startTransition(async () => {
      setOpps({ id: oppId, stageId: newStageId });
      const fd = new FormData();
      fd.set("opportunityId", oppId);
      fd.set("stageId", newStageId);
      await moveOpportunityToStage(fd);
    });
  }

  async function handleStatusChange(opp: Opportunity, status: string) {
    const fd = new FormData();
    fd.set("opportunityId", opp.id);
    fd.set("status", status);
    await updateOpportunityStatus(fd);
  }

  const activeOpp = activeId ? opps.find((o) => o.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            opps={opps.filter((o) => o.stageId === stage.id)}
            allStages={stages}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      <DragOverlay>
        {activeOpp && (
          <DraggableCard
            opp={activeOpp}
            allStages={stages}
            onStatusChange={() => {}}
            isDragOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
