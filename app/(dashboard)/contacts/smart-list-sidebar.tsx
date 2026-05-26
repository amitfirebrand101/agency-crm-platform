"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BookmarkPlus, ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { deleteSmartList, saveSmartList } from "./smart-list-actions";
import type { SmartListFilters } from "./smart-list-actions";

type SmartListItem = {
  id: string;
  name: string;
  filters: SmartListFilters;
};

type Props = {
  lists: SmartListItem[];
  currentFilters: SmartListFilters;
  activeSegmentId?: string;
};

function filtersToSearchParams(filters: SmartListFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.source) params.set("source", filters.source);
  if (filters.tagIds?.length) params.set("tagIds", filters.tagIds.join(","));
  if (filters.scoreMin !== undefined) params.set("scoreMin", String(filters.scoreMin));
  if (filters.scoreMax !== undefined) params.set("scoreMax", String(filters.scoreMax));
  if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
  if (filters.emailOptOut !== undefined) params.set("emailOptOut", String(filters.emailOptOut));
  if (filters.smsOptOut !== undefined) params.set("smsOptOut", String(filters.smsOptOut));
  return params.toString();
}

export function SmartListSidebar({ lists: initialLists, currentFilters, activeSegmentId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [lists, setLists] = useState<SmartListItem[]>(initialLists);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function applySegment(list: SmartListItem) {
    const qs = filtersToSearchParams(list.filters);
    router.push(`/contacts?segment=${list.id}${qs ? `&${qs}` : ""}`);
  }

  function handleSave() {
    if (!saveName.trim()) return;
    setSaveError(null);
    const fd = new FormData();
    fd.set("name", saveName.trim());
    fd.set("filters", JSON.stringify(currentFilters));
    startSave(async () => {
      const result = await saveSmartList(fd);
      if (result.error) {
        setSaveError(result.error);
      } else {
        setLists((prev) => [
          ...prev,
          { id: result.id!, name: saveName.trim(), filters: currentFilters },
        ]);
        setSaveName("");
        setShowSaveInput(false);
      }
    });
  }

  function handleDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startDelete(async () => {
      const result = await deleteSmartList(fd);
      if (!result.error) {
        setLists((prev) => prev.filter((l) => l.id !== id));
        if (activeSegmentId === id) {
          router.push("/contacts");
        }
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-panel shadow-soft">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
      >
        <span>Saved Segments</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="border-t border-border px-3 pb-3">
          {/* Segment list */}
          {lists.length === 0 ? (
            <p className="py-3 text-xs text-muted">No saved segments yet.</p>
          ) : (
            <ul className="mt-2 space-y-0.5">
              {lists.map((list) => (
                <li
                  key={list.id}
                  className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition ${
                    activeSegmentId === list.id
                      ? "bg-primary/10 font-semibold text-primary"
                      : "hover:bg-background"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => applySegment(list)}
                    className="flex-1 text-left truncate"
                  >
                    {list.name}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => handleDelete(list.id)}
                    className="ml-1 shrink-0 rounded p-0.5 text-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                    title="Delete segment"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Save current filters */}
          <div className="mt-3">
            {!showSaveInput ? (
              <button
                type="button"
                onClick={() => setShowSaveInput(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-3 py-2 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
              >
                <BookmarkPlus size={13} />
                Save current filters
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-primary/20 focus:ring-4"
                  placeholder="Segment name…"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") { setShowSaveInput(false); setSaveName(""); }
                  }}
                  maxLength={100}
                />
                {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !saveName.trim()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={11} className="animate-spin" /> : null}
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSaveInput(false); setSaveName(""); setSaveError(null); }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-background"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
