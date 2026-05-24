"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Check, GripVertical, Pencil, Plus, Save, Star, Trash2, X } from "lucide-react";
import { saveSurveyQuestions } from "@/app/(dashboard)/sites/actions";

interface SurveyQuestion {
  id: string;
  type: string;
  text: string;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: string;
}

interface SurveySettings {
  successMessage?: string;
  redirectUrl?: string;
  progressBar?: boolean;
  oneQuestionAtATime?: boolean;
}

interface SurveyResponse {
  id: string;
  answers: Record<string, unknown>;
  createdAt: string;
}

const QUESTION_TYPES = [
  { type: "short_text",    label: "Short Text" },
  { type: "long_text",     label: "Long Text" },
  { type: "multiple",      label: "Multiple Choice" },
  { type: "checkbox",      label: "Checkboxes" },
  { type: "rating",        label: "Star Rating" },
  { type: "nps",           label: "NPS Score" },
  { type: "date",          label: "Date" },
  { type: "scale",         label: "Linear Scale" },
  { type: "email",         label: "Email" },
  { type: "phone",         label: "Phone" },
] as const;

function newQuestion(type: string): SurveyQuestion {
  const label = QUESTION_TYPES.find((q) => q.type === type)?.label ?? "Question";
  return {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    text: `${label} question`,
    required: false,
    options: (type === "multiple" || type === "checkbox") ? ["Option A", "Option B", "Option C"] : undefined,
    min: type === "nps" ? 0 : type === "scale" ? 1 : undefined,
    max: type === "nps" ? 10 : type === "scale" ? 5 : undefined,
  };
}

export function SurveyBuilder({
  surveyId,
  surveyName,
  initialQuestions,
  initialSettings,
  responses,
}: {
  surveyId: string;
  surveyName: string;
  initialQuestions: SurveyQuestion[];
  initialSettings: Record<string, unknown>;
  responses: SurveyResponse[];
}) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>(initialQuestions);
  const [settings, setSettings] = useState<SurveySettings>({
    successMessage: (initialSettings.successMessage as string) ?? "Thank you for completing the survey!",
    redirectUrl: (initialSettings.redirectUrl as string) ?? "",
    progressBar: (initialSettings.progressBar as boolean) ?? true,
    oneQuestionAtATime: (initialSettings.oneQuestionAtATime as boolean) ?? false,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"add" | "settings" | "responses">("add");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const selected = questions.find((q) => q.id === selectedId) ?? null;

  function addQuestion(type: string) {
    const q = newQuestion(type);
    setQuestions((prev) => [...prev, q]);
    setSelectedId(q.id);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function updateQuestion(id: string, patch: Partial<SurveyQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function onDragStart(idx: number) { dragIdx.current = idx; }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === idx) return;
    const next = [...questions];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    dragIdx.current = idx;
    setQuestions(next);
  }
  function onDrop() { dragIdx.current = null; }

  async function handleSave() {
    setSaving(true);
    await saveSurveyQuestions(surveyId, questions as never, settings as never);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="-mx-5 -my-6 lg:-mx-8 flex flex-col" style={{ height: "calc(100vh - 61px)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-white px-5 py-3 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/sites?tab=surveys" className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition">
            <ArrowLeft size={14} /> Surveys
          </Link>
          <span className="text-muted/40">/</span>
          <span className="text-sm font-semibold">{surveyName}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["add", "settings", "responses"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPanel(p)}
                className={`px-3 py-1.5 text-xs font-medium transition capitalize ${panel === p ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
              >
                {p === "responses" ? `Responses (${responses.length})` : p === "add" ? "Questions" : "Settings"}
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
          {panel === "add" && (
            <div className="space-y-1">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted/60">Question Types</p>
              {QUESTION_TYPES.map((qt) => (
                <button
                  key={qt.type}
                  onClick={() => addQuestion(qt.type)}
                  className="flex w-full items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-medium text-muted hover:border-primary hover:text-primary transition"
                >
                  <Plus size={10} /> {qt.label}
                </button>
              ))}
            </div>
          )}

          {panel === "settings" && (
            <div className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted/60">Survey Settings</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Completion Message</label>
                  <textarea className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-xs resize-none" rows={3} value={settings.successMessage} onChange={(e) => setSettings((s) => ({ ...s, successMessage: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Redirect URL</label>
                  <input className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-xs font-mono" placeholder="https://..." value={settings.redirectUrl} onChange={(e) => setSettings((s) => ({ ...s, redirectUrl: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={settings.progressBar} onChange={(e) => setSettings((s) => ({ ...s, progressBar: e.target.checked }))} className="rounded" />
                  <span className="text-xs">Show progress bar</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={settings.oneQuestionAtATime} onChange={(e) => setSettings((s) => ({ ...s, oneQuestionAtATime: e.target.checked }))} className="rounded" />
                  <span className="text-xs">One question at a time</span>
                </label>
              </div>
            </div>
          )}

          {panel === "responses" && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted/60">{responses.length} Responses</p>
              {responses.length === 0 ? (
                <p className="text-xs text-muted py-4 text-center">No responses yet.</p>
              ) : responses.map((r) => (
                <div key={r.id} className="rounded-md border border-border bg-white p-2">
                  <p className="text-[10px] text-muted">{new Date(r.createdAt).toLocaleDateString()}</p>
                  <p className="text-xs text-muted mt-0.5">{Object.keys(r.answers).length} answers</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-[#f4f5f7] p-6">
          <div className="mx-auto max-w-2xl space-y-4">
            {/* Progress bar preview */}
            {settings.progressBar && questions.length > 0 && (
              <div className="rounded-lg border border-border bg-white px-4 py-2">
                <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                  <span>Progress</span>
                  <span>0 / {questions.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: "0%" }} />
                </div>
              </div>
            )}

            {questions.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-border bg-white p-16 text-center text-sm text-muted">
                <p>Add questions from the left panel</p>
              </div>
            ) : (
              questions.map((q, idx) => (
                <div
                  key={q.id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={onDrop}
                  onClick={() => setSelectedId(q.id === selectedId ? null : q.id)}
                  className={`group relative rounded-xl border-2 bg-white p-5 cursor-pointer transition ${selectedId === q.id ? "border-primary shadow-md" : "border-border hover:border-border/60 hover:shadow-sm"}`}
                >
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition">
                    <GripVertical size={14} className="text-muted/40 cursor-grab" />
                  </div>

                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{idx + 1}</span>
                      {selectedId === q.id ? (
                        <input
                          className="text-sm font-semibold bg-transparent border-b border-primary outline-none"
                          value={q.text}
                          onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-semibold">{q.text}{q.required && <span className="ml-0.5 text-red-500">*</span>}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary capitalize">{q.type.replace("_", " ")}</span>
                      {selectedId === q.id && (
                        <button onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }} className="flex size-6 items-center justify-center rounded text-red-500 hover:bg-red-50 transition">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <QuestionPreview question={q} />

                  {selectedId === q.id && (
                    <div className="mt-3 border-t border-border pt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} className="rounded" />
                        <span className="text-xs font-medium">Required</span>
                      </label>
                      {(q.type === "multiple" || q.type === "checkbox") && (
                        <div>
                          <label className="block text-xs font-medium mb-1">Options (one per line)</label>
                          <textarea
                            className="w-full rounded-md border border-border px-2 py-1.5 text-xs font-mono resize-none"
                            rows={4}
                            value={(q.options ?? []).join("\n")}
                            onChange={(e) => updateQuestion(q.id, { options: e.target.value.split("\n").filter((v) => v.trim()) })}
                          />
                        </div>
                      )}
                      {q.type === "scale" && (
                        <div className="flex items-center gap-2">
                          <div>
                            <label className="block text-[10px] font-medium mb-1">Min</label>
                            <input type="number" className="w-16 rounded border border-border px-2 py-1 text-xs" value={q.min ?? 1} onChange={(e) => updateQuestion(q.id, { min: +e.target.value })} />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium mb-1">Max</label>
                            <input type="number" className="w-16 rounded border border-border px-2 py-1 text-xs" value={q.max ?? 5} onChange={(e) => updateQuestion(q.id, { max: +e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionPreview({ question }: { question: SurveyQuestion }) {
  if (question.type === "short_text" || question.type === "email" || question.type === "phone") {
    return <div className="rounded-md border border-border bg-gray-50 px-3 py-2 text-xs text-muted/60">Short answer text</div>;
  }
  if (question.type === "long_text") {
    return <div className="h-16 rounded-md border border-border bg-gray-50 px-3 py-2 text-xs text-muted/60">Long answer text...</div>;
  }
  if (question.type === "multiple") {
    return (
      <div className="space-y-1.5">
        {(question.options ?? []).map((opt) => (
          <div key={opt} className="flex items-center gap-2 rounded-md border border-border bg-gray-50 px-3 py-1.5 text-xs text-muted/80 hover:bg-primary/5 transition cursor-pointer">
            <div className="size-3.5 rounded-full border-2 border-border shrink-0" />
            {opt}
          </div>
        ))}
      </div>
    );
  }
  if (question.type === "checkbox") {
    return (
      <div className="space-y-1.5">
        {(question.options ?? []).map((opt) => (
          <div key={opt} className="flex items-center gap-2 rounded-md border border-border bg-gray-50 px-3 py-1.5 text-xs text-muted/80">
            <div className="size-3.5 rounded border-2 border-border shrink-0" />
            {opt}
          </div>
        ))}
      </div>
    );
  }
  if (question.type === "rating") {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={20} className="text-muted/30 hover:text-amber-400 transition cursor-pointer" />
        ))}
      </div>
    );
  }
  if (question.type === "nps") {
    return (
      <div className="space-y-1">
        <div className="flex gap-1">
          {Array.from({ length: 11 }, (_, i) => (
            <div key={i} className={`flex h-8 flex-1 items-center justify-center rounded text-xs font-medium cursor-pointer transition border border-border ${i <= 6 ? "bg-red-50 text-red-600" : i <= 8 ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}>
              {i}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted">
          <span>Not at all likely</span>
          <span>Extremely likely</span>
        </div>
      </div>
    );
  }
  if (question.type === "scale") {
    const min = question.min ?? 1;
    const max = question.max ?? 5;
    return (
      <div className="flex gap-1.5">
        {Array.from({ length: max - min + 1 }, (_, i) => (
          <div key={i} className="flex h-8 flex-1 items-center justify-center rounded-md border border-border bg-gray-50 text-xs font-medium text-muted cursor-pointer hover:bg-primary/10 hover:text-primary transition">
            {min + i}
          </div>
        ))}
      </div>
    );
  }
  if (question.type === "date") {
    return <div className="rounded-md border border-border bg-gray-50 px-3 py-2 text-xs text-muted/60">MM / DD / YYYY</div>;
  }
  return null;
}
