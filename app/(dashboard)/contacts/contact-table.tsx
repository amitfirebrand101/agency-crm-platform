"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Download, Loader2, Tag, Trash2, User, X } from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { bulkAddTag, bulkDelete, bulkRemoveTag, bulkUpdateStatus } from "./bulk-actions";

type ContactRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  status: string;
  createdAt: string;
  tags: Array<{ tag: { id: string; name: string; color: string } }>;
};

type TagOption = { id: string; name: string; color: string };

const AVATAR_COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#ec4899","#06b6d4","#6366f1"];
function avatarBg(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

export function ContactTable({
  contacts,
  tags,
}: {
  contacts: ContactRow[];
  tags: TagOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [actionOpen, setActionOpen] = useState<"addTag" | "removeTag" | "status" | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const allSelected = selected.size === contacts.length && contacts.length > 0;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(contacts.map((c) => c.id)));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setActionOpen(null);
    setBulkError(null);
    setBulkSuccess(null);
  }

  function flash(msg: string) {
    setBulkSuccess(msg);
    setTimeout(() => setBulkSuccess(null), 3000);
  }

  async function handleBulkAction(action: "addTag" | "removeTag" | "status" | "delete", extraData?: Record<string, string>) {
    setBulkError(null);
    const ids = JSON.stringify(Array.from(selected));
    const fd = new FormData();
    fd.set("ids", ids);
    if (extraData) Object.entries(extraData).forEach(([k, v]) => fd.set(k, v));

    startTransition(async () => {
      let result: { ok: boolean; error?: string };
      switch (action) {
        case "addTag":    result = await bulkAddTag(fd); break;
        case "removeTag": result = await bulkRemoveTag(fd); break;
        case "status":    result = await bulkUpdateStatus(fd); break;
        case "delete":    result = await bulkDelete(fd); break;
        default: return;
      }
      if (result.ok) {
        flash(`Updated ${selected.size} contact${selected.size !== 1 ? "s" : ""}.`);
        clearSelection();
      } else {
        setBulkError(result.error ?? "Action failed.");
      }
    });
  }

  async function handleExport() {
    setExporting(true);
    const ids = selected.size > 0 ? Array.from(selected).join(",") : "";
    const url = `/api/contacts/export${ids ? `?ids=${ids}` : ""}`;
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 shadow-sm">
          <span className="text-sm font-semibold text-primary">
            {selected.size} selected
          </span>
          <div className="ml-2 flex flex-wrap gap-2">
            {/* Add tag */}
            <div className="relative">
              <button
                onClick={() => setActionOpen(actionOpen === "addTag" ? null : "addTag")}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-background transition"
              >
                <Tag size={12} /> Add Tag
              </button>
              {actionOpen === "addTag" && (
                <div className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-border bg-white shadow-lg z-30">
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { handleBulkAction("addTag", { tagId: t.id }); setActionOpen(null); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-background"
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </button>
                  ))}
                  {tags.length === 0 && <p className="px-3 py-2 text-xs text-muted">No tags</p>}
                </div>
              )}
            </div>

            {/* Remove tag */}
            <div className="relative">
              <button
                onClick={() => setActionOpen(actionOpen === "removeTag" ? null : "removeTag")}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-background transition"
              >
                <Tag size={12} /> Remove Tag
              </button>
              {actionOpen === "removeTag" && (
                <div className="absolute left-0 top-full mt-1 w-48 rounded-lg border border-border bg-white shadow-lg z-30">
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { handleBulkAction("removeTag", { tagId: t.id }); setActionOpen(null); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-background"
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </button>
                  ))}
                  {tags.length === 0 && <p className="px-3 py-2 text-xs text-muted">No tags</p>}
                </div>
              )}
            </div>

            {/* Update status */}
            <div className="relative">
              <button
                onClick={() => setActionOpen(actionOpen === "status" ? null : "status")}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-background transition"
              >
                <User size={12} /> Update Status
              </button>
              {actionOpen === "status" && (
                <div className="absolute left-0 top-full mt-1 w-40 rounded-lg border border-border bg-white shadow-lg z-30">
                  {(["LEAD","CUSTOMER","INACTIVE"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { handleBulkAction("status", { status: s }); setActionOpen(null); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-background"
                    >
                      <Badge variant={statusVariant(s)} className="text-[10px]">{s}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export selected */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold hover:bg-background transition disabled:opacity-50"
            >
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Export
            </button>

            {/* Delete */}
            <button
              onClick={() => {
                if (confirm(`Delete ${selected.size} contact${selected.size !== 1 ? "s" : ""}? This cannot be undone.`)) {
                  handleBulkAction("delete");
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>

          <button onClick={clearSelection} className="ml-auto rounded-full p-1 hover:bg-background transition">
            <X size={14} />
          </button>
        </div>
      )}

      {bulkError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {bulkError}
        </div>
      )}
      {bulkSuccess && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {bulkSuccess}
        </div>
      )}

      {/* Export all button */}
      {selected.size === 0 && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition disabled:opacity-50"
          >
            {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Export all
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border" ref={formRef}>
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-border bg-background text-muted">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Tags</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Added</th>
              <th className="px-4 py-3 font-semibold sr-only">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contacts.map((contact) => {
              const fullName = `${contact.firstName} ${contact.lastName ?? ""}`.trim();
              const initial = fullName.charAt(0).toUpperCase();
              const isSelected = selected.has(contact.id);
              return (
                <tr
                  key={contact.id}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.tagName === "INPUT" || target.tagName === "A" || target.closest("a")) return;
                    toggle(contact.id);
                  }}
                  className={[
                    "transition cursor-pointer",
                    isSelected ? "bg-primary/5" : "hover:bg-background",
                  ].join(" ")}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(contact.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: avatarBg(fullName) }}
                      >
                        {initial}
                      </div>
                      <div>
                        <Link
                          className="font-semibold text-foreground hover:text-primary"
                          href={`/contacts/${contact.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {fullName}
                        </Link>
                        {contact.companyName ? (
                          <div className="text-xs text-muted">{contact.companyName}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {contact.email ? (
                      <a
                        className="text-primary hover:underline"
                        href={`mailto:${contact.email}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.email}
                      </a>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {contact.phone ? (
                      <a
                        className="text-foreground hover:text-primary hover:underline"
                        href={`tel:${contact.phone}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.phone}
                      </a>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {!contact.tags.length && <span className="text-muted">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(contact.status)}>{contact.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(contact.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-background"
                      href={`/contacts/${contact.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
