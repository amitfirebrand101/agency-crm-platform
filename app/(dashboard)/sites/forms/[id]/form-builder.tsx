"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, GripVertical, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { saveFormFields, renameForm } from "@/app/(dashboard)/sites/actions";

interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  helpText?: string;
}

interface FormSettings {
  successMessage?: string;
  redirectUrl?: string;
  stickyContact?: boolean;
  submitLabel?: string;
}

interface Submission {
  id: string;
  data: Record<string, string>;
  createdAt: string;
}

const FIELD_TYPES = [
  { type: "text",       label: "Short Text",    group: "Basic" },
  { type: "textarea",   label: "Long Text",     group: "Basic" },
  { type: "email",      label: "Email",         group: "Basic" },
  { type: "phone",      label: "Phone",         group: "Basic" },
  { type: "number",     label: "Number",        group: "Basic" },
  { type: "date",       label: "Date",          group: "Basic" },
  { type: "select",     label: "Dropdown",      group: "Choice" },
  { type: "radio",      label: "Radio Buttons", group: "Choice" },
  { type: "checkbox",   label: "Checkboxes",    group: "Choice" },
  { type: "file",       label: "File Upload",   group: "Advanced" },
  { type: "address",    label: "Address",       group: "Advanced" },
  { type: "hidden",     label: "Hidden Field",  group: "Advanced" },
  { type: "divider",    label: "Divider",       group: "Layout" },
  { type: "heading",    label: "Heading",       group: "Layout" },
] as const;

const GROUPS = ["Basic", "Choice", "Advanced", "Layout"];

function newField(type: string): FormField {
  const label = FIELD_TYPES.find((f) => f.type === type)?.label ?? "Field";
  return {
    id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    label: type === "email" ? "Email Address" : type === "phone" ? "Phone Number" : label,
    placeholder: "",
    required: type !== "divider" && type !== "heading",
    options: type === "select" || type === "radio" || type === "checkbox" ? ["Option 1", "Option 2"] : undefined,
  };
}

type PanelMode = "fields" | "settings" | "submissions";

export function FormBuilder({
  formId,
  formName,
  initialFields,
  initialSettings,
  submissions,
}: {
  formId: string;
  formName: string;
  initialFields: FormField[];
  initialSettings: Record<string, unknown>;
  submissions: Submission[];
}) {
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [settings, setSettings] = useState<FormSettings>({
    successMessage: (initialSettings.successMessage as string) ?? "Thank you! Your submission has been received.",
    redirectUrl: (initialSettings.redirectUrl as string) ?? "",
    stickyContact: (initialSettings.stickyContact as boolean) ?? true,
    submitLabel: (initialSettings.submitLabel as string) ?? "Submit",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelMode>("fields");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(formName);
  const [nameInput, setNameInput] = useState(formName);
  const dragIdx = useRef<number | null>(null);

  const selected = fields.find((f) => f.id === selectedId) ?? null;

  function addField(type: string) {
    const f = newField(type);
    setFields((prev) => [...prev, f]);
    setSelectedId(f.id);
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function onDragStart(idx: number) { dragIdx.current = idx; }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === idx) return;
    const next = [...fields];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    dragIdx.current = idx;
    setFields(next);
  }
  function onDrop() { dragIdx.current = null; }

  async function handleSave() {
    setSaving(true);
    await saveFormFields(formId, fields as never, settings as never);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleRenameSave() {
    const fd = new FormData();
    fd.append("formId", formId);
    fd.append("name", nameInput.trim() || name);
    await renameForm(fd);
    setName(nameInput.trim() || name);
    setEditingName(false);
  }

  return (
    <div className="-mx-5 -my-6 lg:-mx-8 flex flex-col" style={{ height: "calc(100vh - 61px)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-white px-5 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/sites?tab=forms" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
            <ArrowLeft size={14} /> Forms
          </Link>
          <span className="text-muted/40">/</span>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="rounded border border-border px-2 py-0.5 text-sm font-semibold"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRenameSave(); if (e.key === "Escape") setEditingName(false); }}
              />
              <button onClick={handleRenameSave} className="flex size-6 items-center justify-center rounded bg-primary/10 text-primary"><Check size={12} /></button>
              <button onClick={() => setEditingName(false)} className="flex size-6 items-center justify-center rounded hover:bg-background text-muted"><X size={12} /></button>
            </div>
          ) : (
            <button onClick={() => { setNameInput(name); setEditingName(true); }} className="flex items-center gap-1.5 text-sm font-semibold hover:text-primary transition">
              {name} <Pencil size={12} className="text-muted" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["fields", "settings", "submissions"] as PanelMode[]).map((p) => (
              <button
                key={p}
                onClick={() => setPanel(p)}
                className={`px-3 py-1.5 text-xs font-medium transition capitalize ${panel === p ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
              >
                {p === "submissions" ? `Submissions (${submissions.length})` : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${saved ? "bg-emerald-600 text-white" : "bg-primary text-white hover:bg-primary/90"}`}
          >
            {saved ? <><Check size={13} /> Saved</> : saving ? "Saving..." : <><Save size={13} /> Save</>}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-64 shrink-0 overflow-y-auto border-r border-border bg-[#f8f9fa] p-3">
          {panel === "fields" && (
            <div className="space-y-3">
              {GROUPS.map((group) => (
                <div key={group}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/60">{group}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {FIELD_TYPES.filter((f) => f.group === group).map((ft) => (
                      <button
                        key={ft.type}
                        onClick={() => addField(ft.type)}
                        className="flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary transition"
                      >
                        <Plus size={10} /> {ft.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {panel === "settings" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted/60">Form Settings</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Submit Button Label</label>
                  <input className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-xs" value={settings.submitLabel} onChange={(e) => setSettings((s) => ({ ...s, submitLabel: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Success Message</label>
                  <textarea className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-xs resize-none" rows={3} value={settings.successMessage} onChange={(e) => setSettings((s) => ({ ...s, successMessage: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Redirect URL (optional)</label>
                  <input className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-xs font-mono" placeholder="https://..." value={settings.redirectUrl} onChange={(e) => setSettings((s) => ({ ...s, redirectUrl: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={settings.stickyContact} onChange={(e) => setSettings((s) => ({ ...s, stickyContact: e.target.checked }))} className="rounded" />
                  <span className="text-xs">Sticky Contact (pre-fill known values)</span>
                </label>
              </div>
            </div>
          )}

          {panel === "submissions" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted/60">{submissions.length} Submissions</p>
              {submissions.length === 0 ? (
                <p className="text-xs text-muted py-4 text-center">No submissions yet.</p>
              ) : submissions.map((sub) => {
                const vals = Object.values(sub.data).filter(Boolean);
                return (
                  <div key={sub.id} className="rounded-md border border-border bg-white p-2">
                    <p className="text-xs font-medium truncate">{vals[0] || "Anonymous"}</p>
                    <p className="text-[10px] text-muted">{new Date(sub.createdAt).toLocaleDateString()}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6">
          <div className="mx-auto max-w-lg">
            <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
              {/* Form header preview */}
              <div className="border-b border-border px-6 py-4 bg-gradient-to-r from-primary/5 to-transparent">
                <p className="font-semibold text-sm">{name}</p>
                <p className="text-xs text-muted mt-0.5">Form preview</p>
              </div>

              <div className="p-5 space-y-1">
                {fields.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted">
                    <p>Add fields from the left panel</p>
                  </div>
                ) : (
                  fields.map((field, idx) => (
                    <FieldPreview
                      key={field.id}
                      field={field}
                      isSelected={selectedId === field.id}
                      onSelect={() => setSelectedId(field.id === selectedId ? null : field.id)}
                      onRemove={() => removeField(field.id)}
                      onDragStart={() => onDragStart(idx)}
                      onDragOver={(e) => onDragOver(e, idx)}
                      onDrop={onDrop}
                    />
                  ))
                )}

                {/* Submit button preview */}
                <div className="pt-3">
                  <button
                    type="button"
                    className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                    disabled
                  >
                    {settings.submitLabel || "Submit"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel: field settings */}
        {selected && (
          <div className="w-64 shrink-0 overflow-y-auto border-l border-border bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Field Settings</p>
              <button onClick={() => setSelectedId(null)} className="text-muted hover:text-foreground transition"><X size={14} /></button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium mb-1">Label</label>
                <input className="w-full rounded-md border border-border px-2 py-1.5 text-sm" value={selected.label} onChange={(e) => updateField(selected.id, { label: e.target.value })} />
              </div>

              {selected.type !== "divider" && selected.type !== "heading" && selected.type !== "hidden" && (
                <div>
                  <label className="block text-xs font-medium mb-1">Placeholder</label>
                  <input className="w-full rounded-md border border-border px-2 py-1.5 text-sm" value={selected.placeholder ?? ""} onChange={(e) => updateField(selected.id, { placeholder: e.target.value })} />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">Help Text</label>
                <input className="w-full rounded-md border border-border px-2 py-1.5 text-sm" value={selected.helpText ?? ""} onChange={(e) => updateField(selected.id, { helpText: e.target.value })} placeholder="Optional hint" />
              </div>

              {selected.type !== "divider" && selected.type !== "heading" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selected.required} onChange={(e) => updateField(selected.id, { required: e.target.checked })} className="rounded" />
                  <span className="text-xs font-medium">Required field</span>
                </label>
              )}

              {(selected.type === "select" || selected.type === "radio" || selected.type === "checkbox") && (
                <div>
                  <label className="block text-xs font-medium mb-1">Options (one per line)</label>
                  <textarea
                    className="w-full rounded-md border border-border px-2 py-1.5 text-xs font-mono resize-none"
                    rows={5}
                    value={(selected.options ?? []).join("\n")}
                    onChange={(e) => updateField(selected.id, { options: e.target.value.split("\n").filter((v) => v.trim()) })}
                  />
                </div>
              )}

              <button
                onClick={() => removeField(selected.id)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
              >
                <Trash2 size={12} /> Remove Field
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldPreview({
  field, isSelected, onSelect, onRemove, onDragStart, onDragOver, onDrop,
}: {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  if (field.type === "divider") {
    return (
      <div
        draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}
        onClick={onSelect}
        className={`group relative flex items-center gap-2 cursor-pointer rounded px-2 py-2 transition ${isSelected ? "ring-2 ring-primary" : "hover:bg-gray-50"}`}
      >
        <GripVertical size={12} className="text-muted/30 group-hover:text-muted/60" />
        <hr className="flex-1 border-border" />
        {isSelected && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500"><X size={12} /></button>}
      </div>
    );
  }

  if (field.type === "heading") {
    return (
      <div
        draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}
        onClick={onSelect}
        className={`group relative flex items-center gap-2 cursor-pointer rounded px-2 py-2 transition ${isSelected ? "ring-2 ring-primary" : "hover:bg-gray-50"}`}
      >
        <GripVertical size={12} className="text-muted/30 group-hover:text-muted/60" />
        <p className="font-semibold text-sm">{field.label}</p>
        {isSelected && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500"><X size={12} /></button>}
      </div>
    );
  }

  return (
    <div
      draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}
      onClick={onSelect}
      className={`group relative rounded-lg border-2 cursor-pointer px-3 py-2.5 transition ${isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-border"}`}
    >
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition">
        <GripVertical size={12} className="text-muted/40" />
      </div>

      <label className="block text-xs font-medium mb-1.5 text-foreground">
        {field.label}{field.required && <span className="ml-0.5 text-red-500">*</span>}
      </label>

      {field.type === "textarea" ? (
        <div className="h-14 rounded-md border border-border bg-gray-50 px-2 py-1.5 text-xs text-muted/60">{field.placeholder}</div>
      ) : field.type === "select" ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-gray-50 px-2 py-1.5 text-xs text-muted/60">
          <span>{field.placeholder || "Select an option"}</span>
          <ChevronDown size={10} />
        </div>
      ) : field.type === "radio" ? (
        <div className="space-y-1">
          {(field.options ?? []).slice(0, 3).map((opt) => (
            <div key={opt} className="flex items-center gap-1.5 text-xs text-muted/60">
              <div className="size-3 rounded-full border border-border" /> {opt}
            </div>
          ))}
        </div>
      ) : field.type === "checkbox" ? (
        <div className="space-y-1">
          {(field.options ?? []).slice(0, 3).map((opt) => (
            <div key={opt} className="flex items-center gap-1.5 text-xs text-muted/60">
              <div className="size-3 rounded border border-border" /> {opt}
            </div>
          ))}
        </div>
      ) : field.type === "file" ? (
        <div className="rounded-md border-2 border-dashed border-border bg-gray-50 px-3 py-3 text-center text-xs text-muted/60">
          Click to upload or drag & drop
        </div>
      ) : (
        <div className="rounded-md border border-border bg-gray-50 px-2 py-1.5 text-xs text-muted/60">
          {field.placeholder || field.label}
        </div>
      )}

      {field.helpText && <p className="mt-1 text-[10px] text-muted">{field.helpText}</p>}

      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute right-2 top-2 flex size-5 items-center justify-center rounded text-red-500 hover:bg-red-50 transition"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
