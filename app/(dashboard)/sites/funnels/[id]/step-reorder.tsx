"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, GripVertical, LayoutTemplate, Pencil, Trash2, TrendingUp, MousePointerClick, X, Check } from "lucide-react";
import { deleteFunnelStep, reorderFunnelSteps, updateFunnelStep } from "@/app/(dashboard)/sites/actions";

interface PageRow {
  id: string;
  name: string;
  type: string;
  pathSlug: string;
  visits: number;
  conversions: number;
  order: number;
}

const TYPE_COLORS: Record<string, string> = {
  "opt-in":       "bg-blue-100 text-blue-700 border-blue-200",
  "sales":        "bg-violet-100 text-violet-700 border-violet-200",
  "upsell":       "bg-emerald-100 text-emerald-700 border-emerald-200",
  "downsell":     "bg-orange-100 text-orange-700 border-orange-200",
  "confirmation": "bg-teal-100 text-teal-700 border-teal-200",
  "checkout":     "bg-pink-100 text-pink-700 border-pink-200",
  "custom":       "bg-gray-100 text-gray-700 border-gray-200",
};

const PAGE_TYPES = ["opt-in", "sales", "upsell", "downsell", "confirmation", "checkout", "custom"];

export function StepReorder({ funnelId, pages }: { funnelId: string; pages: PageRow[]; }) {
  const [items, setItems] = useState(pages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const dragIdx = useRef<number | null>(null);

  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === idx) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    dragIdx.current = idx;
    setItems(next);
  }

  async function onDrop() {
    dragIdx.current = null;
    await reorderFunnelSteps(funnelId, items.map((i) => i.id));
  }

  function startEdit(page: PageRow) {
    setEditingId(page.id);
    setEditName(page.name);
    setEditType(page.type);
    setEditSlug(page.pathSlug);
  }

  async function saveEdit() {
    if (!editingId) return;
    const fd = new FormData();
    fd.append("pageId", editingId);
    fd.append("funnelId", funnelId);
    fd.append("name", editName);
    fd.append("type", editType);
    fd.append("pathSlug", editSlug);
    await updateFunnelStep(fd);
    setItems((prev) => prev.map((p) => p.id === editingId ? { ...p, name: editName, type: editType, pathSlug: editSlug } : p));
    setEditingId(null);
  }

  async function handleDelete(pageId: string) {
    const fd = new FormData();
    fd.append("pageId", pageId);
    fd.append("funnelId", funnelId);
    await deleteFunnelStep(fd);
    setItems((prev) => prev.filter((p) => p.id !== pageId));
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-10 text-center text-sm text-muted">
        No steps yet. Add your first step below.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {items.map((page, idx) => {
        const typeColor = TYPE_COLORS[page.type] ?? "bg-gray-100 text-gray-700 border-gray-200";
        const convRate = page.visits > 0 ? ((page.conversions / page.visits) * 100).toFixed(0) : "0";
        const isEditing = editingId === page.id;

        return (
          <div key={page.id} className="relative">
            <div
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={onDrop}
              className="group flex items-stretch gap-0 rounded-xl border border-border bg-white shadow-sm transition hover:border-primary hover:shadow-md cursor-grab active:cursor-grabbing"
            >
              {/* Drag handle */}
              <div className="flex items-center px-3 text-muted/40 group-hover:text-muted transition">
                <GripVertical size={16} />
              </div>

              {/* Step number */}
              <div className="flex items-center justify-center w-8 shrink-0">
                <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {idx + 1}
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 py-3 pr-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <input
                        className="w-32 rounded-md border border-border bg-background px-2 py-1 text-xs font-mono"
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value)}
                        placeholder="path-slug"
                      />
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {PAGE_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditType(t)}
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize transition ${editType === t ? "ring-2 ring-primary " + (TYPE_COLORS[t] ?? "") : TYPE_COLORS[t] ?? "border-gray-200 text-gray-600"}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{page.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${typeColor}`}>{page.type}</span>
                    <span className="text-xs text-muted font-mono">/{page.pathSlug}</span>
                  </div>
                )}

                {!isEditing && (
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><MousePointerClick size={10} />{page.visits.toLocaleString()} visits</span>
                    <span className="flex items-center gap-1"><TrendingUp size={10} />{page.conversions.toLocaleString()} conversions</span>
                    <span className="font-medium text-foreground">{convRate}% rate</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 px-3">
                {isEditing ? (
                  <>
                    <button onClick={saveEdit} className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition" type="button">
                      <Check size={13} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex size-7 items-center justify-center rounded-lg hover:bg-background transition text-muted" type="button">
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href={`/sites/funnels/${funnelId}/builder?page=${page.id}`}
                      className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LayoutTemplate size={11} /> Build
                    </Link>
                    <button onClick={() => startEdit(page)} className="flex size-7 items-center justify-center rounded-lg hover:bg-background text-muted hover:text-foreground transition" type="button">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(page.id)} className="flex size-7 items-center justify-center rounded-lg hover:bg-red-50 text-muted hover:text-red-600 transition" type="button">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Arrow connector between steps */}
            {idx < items.length - 1 && (
              <div className="flex justify-center py-1.5 text-muted/40">
                <ArrowRight size={14} className="rotate-90" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
