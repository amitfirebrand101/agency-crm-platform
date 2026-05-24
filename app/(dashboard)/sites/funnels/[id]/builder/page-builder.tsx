"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowLeft, Check, ChevronDown, ChevronRight,
  Code, Copy, Eye, GripVertical, Image, Laptop, Monitor, Minus, Move,
  Pencil, Plus, Save, Smartphone, Tablet, Trash2, Type, X, Youtube, Zap,
} from "lucide-react";
import { savePageContent, renamePage } from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ElementType =
  | "headline" | "paragraph" | "button" | "image" | "video"
  | "divider" | "spacer" | "icon_list" | "html" | "form_embed" | "countdown";

export interface PageElement {
  id: string;
  type: ElementType;
  props: Record<string, unknown>;
}

export interface PageColumn {
  id: string;
  widthPercent: number;
  elements: PageElement[];
}

export interface PageSection {
  id: string;
  label?: string;
  layout: "1col" | "2col" | "3col" | "2-1col" | "1-2col";
  props: {
    backgroundColor: string;
    backgroundImage: string;
    backgroundSize: string;
    backgroundPosition: string;
    paddingTop: number;
    paddingBottom: number;
    paddingLeft: number;
    paddingRight: number;
    fullWidth: boolean;
    maxWidth: number;
    minHeight: number;
  };
  columns: PageColumn[];
}

export interface PageContent {
  sections: PageSection[];
  globalStyles: {
    fontFamily: string;
    bodyBackgroundColor: string;
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function makeColumn(widthPercent: number): PageColumn {
  return { id: `col_${uid()}`, widthPercent, elements: [] };
}

function makeSection(layout: PageSection["layout"] = "1col"): PageSection {
  const cols: PageColumn[] = {
    "1col":  [makeColumn(100)],
    "2col":  [makeColumn(50), makeColumn(50)],
    "3col":  [makeColumn(33.33), makeColumn(33.33), makeColumn(33.33)],
    "2-1col":[makeColumn(66.66), makeColumn(33.33)],
    "1-2col":[makeColumn(33.33), makeColumn(66.66)],
  }[layout];

  return {
    id: `sec_${uid()}`,
    layout,
    props: {
      backgroundColor: "#ffffff",
      backgroundImage: "",
      backgroundSize: "cover",
      backgroundPosition: "center center",
      paddingTop: 60,
      paddingBottom: 60,
      paddingLeft: 20,
      paddingRight: 20,
      fullWidth: false,
      maxWidth: 1100,
      minHeight: 0,
    },
    columns: cols,
  };
}

function defaultProps(type: ElementType): Record<string, unknown> {
  switch (type) {
    case "headline":  return { text: "Your Headline Here", tag: "h2", fontSize: 40, fontWeight: "700", color: "#1a1a1a", textAlign: "center", lineHeight: 1.2, paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, marginTop: 0, marginBottom: 16 };
    case "paragraph": return { text: "Write your content here. Click to edit this text and start adding your own copy.", fontSize: 16, lineHeight: 1.7, color: "#555555", textAlign: "left", maxWidth: "", paddingTop: 0, paddingBottom: 0, marginTop: 0, marginBottom: 16 };
    case "button":    return { text: "Click Here", url: "#", newTab: false, backgroundColor: "#6366f1", textColor: "#ffffff", fontSize: 16, fontWeight: "600", borderRadius: 8, paddingTop: 14, paddingBottom: 14, paddingLeft: 32, paddingRight: 32, fullWidth: false, alignment: "center", marginTop: 8, marginBottom: 8 };
    case "image":     return { src: "https://placehold.co/800x400/e8e8e8/666?text=Your+Image", alt: "", url: "", newTab: false, width: 100, borderRadius: 0, alignment: "center", marginTop: 0, marginBottom: 16, boxShadow: "none" };
    case "video":     return { url: "", type: "youtube", borderRadius: 8, aspectRatio: "16/9", marginTop: 0, marginBottom: 16 };
    case "divider":   return { color: "#e5e7eb", thickness: 1, width: 100, marginTop: 24, marginBottom: 24 };
    case "spacer":    return { height: 40 };
    case "icon_list": return { items: [{ icon: "✓", text: "First benefit goes here" }, { icon: "✓", text: "Second benefit goes here" }, { icon: "✓", text: "Third benefit goes here" }], iconColor: "#6366f1", fontSize: 16, gap: 12, marginTop: 0, marginBottom: 16 };
    case "html":      return { html: "<p>Custom HTML content</p>", css: "" };
    case "form_embed":return { formId: "", formName: "Select a form", buttonText: "Submit", buttonColor: "#6366f1" };
    case "countdown": return { endDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16), backgroundColor: "#1a1a1a", textColor: "#ffffff", digitSize: 48, showLabels: true, marginTop: 0, marginBottom: 16 };
    default:          return {};
  }
}

function makeElement(type: ElementType): PageElement {
  return { id: `el_${uid()}`, type, props: defaultProps(type) };
}

const EMPTY_PAGE: PageContent = {
  sections: [makeSection("1col")],
  globalStyles: { fontFamily: "system-ui, sans-serif", bodyBackgroundColor: "#f9fafb" },
};

// ─── Element Catalogue ────────────────────────────────────────────────────────

const ELEMENT_GROUPS = [
  {
    label: "Basic",
    items: [
      { type: "headline" as ElementType,  icon: "H1",  label: "Headline" },
      { type: "paragraph" as ElementType, icon: "¶",   label: "Paragraph" },
      { type: "button" as ElementType,    icon: "▶",   label: "Button" },
      { type: "image" as ElementType,     icon: "🖼",  label: "Image" },
      { type: "video" as ElementType,     icon: "▷",   label: "Video" },
    ],
  },
  {
    label: "Layout",
    items: [
      { type: "divider" as ElementType,   icon: "—",   label: "Divider" },
      { type: "spacer" as ElementType,    icon: "↕",   label: "Spacer" },
    ],
  },
  {
    label: "Advanced",
    items: [
      { type: "icon_list" as ElementType, icon: "✓",   label: "Bullet List" },
      { type: "countdown" as ElementType, icon: "⏱",  label: "Countdown" },
      { type: "form_embed" as ElementType,icon: "📋",  label: "Form" },
      { type: "html" as ElementType,      icon: "<>",  label: "Custom HTML" },
    ],
  },
];

const SECTION_LAYOUTS: { layout: PageSection["layout"]; label: string; preview: string }[] = [
  { layout: "1col",   label: "Full Width",    preview: "█████" },
  { layout: "2col",   label: "Two Columns",   preview: "██ ██" },
  { layout: "3col",   label: "Three Columns", preview: "█ █ █" },
  { layout: "2-1col", label: "2/3 · 1/3",    preview: "███ █" },
  { layout: "1-2col", label: "1/3 · 2/3",    preview: "█ ███" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

type Selection =
  | { kind: "page" }
  | { kind: "section"; sectionId: string }
  | { kind: "element"; sectionId: string; colId: string; elementId: string };

type DeviceMode = "desktop" | "tablet" | "mobile";

export function PageBuilder({
  funnelId,
  funnelName,
  pages,
  activePage,
  availableForms,
}: {
  funnelId: string;
  funnelName: string;
  pages: { id: string; name: string; type: string }[];
  activePage: { id: string; name: string; type: string; content: unknown };
  availableForms: { id: string; name: string }[];
}) {
  function parseContent(raw: unknown): PageContent {
    if (raw && typeof raw === "object" && !Array.isArray(raw) && "sections" in raw) {
      return raw as PageContent;
    }
    return EMPTY_PAGE;
  }

  const [content, setContent] = useState<PageContent>(() => parseContent(activePage.content));
  const [selection, setSelection] = useState<Selection>({ kind: "page" });
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [leftTab, setLeftTab] = useState<"elements" | "sections" | "layers">("elements");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pageName, setPageName] = useState(activePage.name);
  const [editingName, setEditingName] = useState(false);
  const [preview, setPreview] = useState(false);
  const [isPending, startTransition] = useTransition();

  // History for undo/redo
  const history = useRef<PageContent[]>([parseContent(activePage.content)]);
  const historyIdx = useRef(0);

  function pushHistory(next: PageContent) {
    history.current = history.current.slice(0, historyIdx.current + 1);
    history.current.push(next);
    historyIdx.current = history.current.length - 1;
  }

  function mutate(updater: (prev: PageContent) => PageContent) {
    setContent((prev) => {
      const next = updater(prev);
      pushHistory(next);
      return next;
    });
  }

  function undo() {
    if (historyIdx.current > 0) {
      historyIdx.current--;
      setContent(history.current[historyIdx.current]);
    }
  }

  function redo() {
    if (historyIdx.current < history.current.length - 1) {
      historyIdx.current++;
      setContent(history.current[historyIdx.current]);
    }
  }

  async function handleSave() {
    setSaving(true);
    await savePageContent(activePage.id, funnelId, content);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleRenamePage(newName: string) {
    startTransition(async () => {
      await renamePage(activePage.id, funnelId, newName);
    });
    setPageName(newName);
    setEditingName(false);
  }

  // ─── Canvas mutation helpers ──────────────────────────────────────────────

  function addSection(layout: PageSection["layout"]) {
    mutate((p) => ({ ...p, sections: [...p.sections, makeSection(layout)] }));
  }

  function deleteSection(sectionId: string) {
    mutate((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== sectionId) }));
    setSelection({ kind: "page" });
  }

  function duplicateSection(sectionId: string) {
    mutate((p) => {
      const idx = p.sections.findIndex((s) => s.id === sectionId);
      if (idx < 0) return p;
      const copy: PageSection = JSON.parse(JSON.stringify(p.sections[idx]));
      copy.id = `sec_${uid()}`;
      copy.columns = copy.columns.map((c) => ({
        ...c,
        id: `col_${uid()}`,
        elements: c.elements.map((e) => ({ ...e, id: `el_${uid()}` })),
      }));
      const next = [...p.sections];
      next.splice(idx + 1, 0, copy);
      return { ...p, sections: next };
    });
  }

  function moveSectionUp(sectionId: string) {
    mutate((p) => {
      const idx = p.sections.findIndex((s) => s.id === sectionId);
      if (idx <= 0) return p;
      const next = [...p.sections];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return { ...p, sections: next };
    });
  }

  function moveSectionDown(sectionId: string) {
    mutate((p) => {
      const idx = p.sections.findIndex((s) => s.id === sectionId);
      if (idx >= p.sections.length - 1) return p;
      const next = [...p.sections];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return { ...p, sections: next };
    });
  }

  function updateSectionProps(sectionId: string, patch: Partial<PageSection["props"]>) {
    mutate((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.id === sectionId ? { ...s, props: { ...s.props, ...patch } } : s
      ),
    }));
  }

  function addElement(sectionId: string, colId: string, type: ElementType) {
    const el = makeElement(type);
    mutate((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.id !== sectionId ? s : {
          ...s,
          columns: s.columns.map((c) =>
            c.id !== colId ? c : { ...c, elements: [...c.elements, el] }
          ),
        }
      ),
    }));
    setSelection({ kind: "element", sectionId, colId, elementId: el.id });
  }

  function deleteElement(sectionId: string, colId: string, elementId: string) {
    mutate((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.id !== sectionId ? s : {
          ...s,
          columns: s.columns.map((c) =>
            c.id !== colId ? c : { ...c, elements: c.elements.filter((e) => e.id !== elementId) }
          ),
        }
      ),
    }));
    setSelection({ kind: "section", sectionId });
  }

  function duplicateElement(sectionId: string, colId: string, elementId: string) {
    mutate((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.id !== sectionId ? s : {
          ...s,
          columns: s.columns.map((c) => {
            if (c.id !== colId) return c;
            const idx = c.elements.findIndex((e) => e.id === elementId);
            if (idx < 0) return c;
            const copy: PageElement = JSON.parse(JSON.stringify(c.elements[idx]));
            copy.id = `el_${uid()}`;
            const next = [...c.elements];
            next.splice(idx + 1, 0, copy);
            return { ...c, elements: next };
          }),
        }
      ),
    }));
  }

  function updateElement(sectionId: string, colId: string, elementId: string, patch: Partial<Record<string, unknown>>) {
    mutate((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.id !== sectionId ? s : {
          ...s,
          columns: s.columns.map((c) =>
            c.id !== colId ? c : {
              ...c,
              elements: c.elements.map((e) =>
                e.id !== elementId ? e : { ...e, props: { ...e.props, ...patch } }
              ),
            }
          ),
        }
      ),
    }));
  }

  function moveElementUp(sectionId: string, colId: string, elementId: string) {
    mutate((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.id !== sectionId ? s : {
          ...s,
          columns: s.columns.map((c) => {
            if (c.id !== colId) return c;
            const idx = c.elements.findIndex((e) => e.id === elementId);
            if (idx <= 0) return c;
            const next = [...c.elements];
            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
            return { ...c, elements: next };
          }),
        }
      ),
    }));
  }

  function moveElementDown(sectionId: string, colId: string, elementId: string) {
    mutate((p) => ({
      ...p,
      sections: p.sections.map((s) =>
        s.id !== sectionId ? s : {
          ...s,
          columns: s.columns.map((c) => {
            if (c.id !== colId) return c;
            const idx = c.elements.findIndex((e) => e.id === elementId);
            if (idx >= c.elements.length - 1) return c;
            const next = [...c.elements];
            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
            return { ...c, elements: next };
          }),
        }
      ),
    }));
  }

  function updateGlobalStyles(patch: Partial<PageContent["globalStyles"]>) {
    mutate((p) => ({ ...p, globalStyles: { ...p.globalStyles, ...patch } }));
  }

  // ─── Drag helpers ─────────────────────────────────────────────────────────

  const dragEl = useRef<{ sectionId: string; colId: string; elementId: string } | null>(null);
  const dragSec = useRef<string | null>(null);

  function onElementDragStart(sectionId: string, colId: string, elementId: string) {
    dragEl.current = { sectionId, colId, elementId };
  }

  function onElementDrop(targetSectionId: string, targetColId: string, targetIdx: number) {
    const src = dragEl.current;
    dragEl.current = null;
    if (!src) return;

    mutate((p) => {
      // Remove from source
      let removed: PageElement | undefined;
      const sections = p.sections.map((s) => {
        if (s.id !== src.sectionId) return s;
        return {
          ...s,
          columns: s.columns.map((c) => {
            if (c.id !== src.colId) return c;
            const idx = c.elements.findIndex((e) => e.id === src.elementId);
            if (idx < 0) return c;
            const next = [...c.elements];
            [removed] = next.splice(idx, 1);
            return { ...c, elements: next };
          }),
        };
      });
      if (!removed) return p;
      // Insert into target
      return {
        ...p,
        sections: sections.map((s) => {
          if (s.id !== targetSectionId) return s;
          return {
            ...s,
            columns: s.columns.map((c) => {
              if (c.id !== targetColId) return c;
              const next = [...c.elements];
              next.splice(targetIdx, 0, removed!);
              return { ...c, elements: next };
            }),
          };
        }),
      };
    });
  }

  // ─── Selected data ────────────────────────────────────────────────────────

  const selectedSection = selection.kind !== "page"
    ? content.sections.find((s) => s.id === selection.sectionId) ?? null
    : null;

  const selectedElement = selection.kind === "element"
    ? selectedSection?.columns.find((c) => c.id === selection.colId)
        ?.elements.find((e) => e.id === selection.elementId) ?? null
    : null;

  const DEVICE_WIDTHS: Record<DeviceMode, string> = {
    desktop: "100%",
    tablet:  "768px",
    mobile:  "390px",
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (preview) {
    return (
      <div className="-mx-5 -my-6 lg:-mx-8 flex flex-col" style={{ height: "calc(100vh - 61px)" }}>
        <div className="flex items-center justify-between border-b border-border bg-white px-5 py-3">
          <span className="text-sm font-semibold">{pageName} — Preview</span>
          <button onClick={() => setPreview(false)} className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/20 transition">
            ← Edit
          </button>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ backgroundColor: content.globalStyles.bodyBackgroundColor, fontFamily: content.globalStyles.fontFamily }}>
          <PagePreview content={content} />
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-5 -my-6 lg:-mx-8 flex flex-col" style={{ height: "calc(100vh - 61px)" }}>
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-white px-4 py-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/sites/funnels/${funnelId}`} className="flex shrink-0 items-center gap-1.5 text-xs text-muted hover:text-foreground transition">
            <ArrowLeft size={13} /> {funnelName}
          </Link>
          <span className="text-muted/40 shrink-0">/</span>
          {editingName ? (
            <form onSubmit={(e) => { e.preventDefault(); handleRenamePage((e.currentTarget[0] as HTMLInputElement).value || pageName); }}>
              <input
                defaultValue={pageName}
                autoFocus
                onBlur={(e) => handleRenamePage(e.target.value || pageName)}
                className="rounded border border-primary px-2 py-0.5 text-sm font-semibold outline-none"
              />
            </form>
          ) : (
            <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 truncate text-sm font-semibold hover:text-primary transition">
              {pageName} <Pencil size={11} className="shrink-0 text-muted" />
            </button>
          )}

          {/* Page switcher */}
          {pages.length > 1 && (
            <div className="flex items-center gap-1 ml-2">
              {pages.map((p) => (
                <Link
                  key={p.id}
                  href={`/sites/funnels/${funnelId}/builder?page=${p.id}`}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition ${p.id === activePage.id ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"}`}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Device preview */}
          <div className="flex rounded-lg border border-border overflow-hidden mr-2">
            {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((d) => {
              const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
              return (
                <button key={d} onClick={() => setDevice(d)} className={`flex items-center px-2 py-1.5 transition ${device === d ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"}`}>
                  <Icon size={14} />
                </button>
              );
            })}
          </div>

          {/* Undo / Redo */}
          <button onClick={undo} disabled={historyIdx.current === 0} className="flex size-7 items-center justify-center rounded hover:bg-background text-muted disabled:opacity-30 transition text-xs font-bold">
            ↩
          </button>
          <button onClick={redo} disabled={historyIdx.current >= history.current.length - 1} className="flex size-7 items-center justify-center rounded hover:bg-background text-muted disabled:opacity-30 transition text-xs font-bold">
            ↪
          </button>

          <button onClick={() => setPreview(true)} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:text-foreground transition">
            <Eye size={13} /> Preview
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${saved ? "bg-emerald-600 text-white" : "bg-primary text-white hover:bg-primary/90"}`}
          >
            {saved ? <><Check size={13} /> Saved</> : saving ? "Saving…" : <><Save size={13} /> Save</>}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ───────────────────────────────────────────── */}
        <div className="flex w-[260px] shrink-0 flex-col border-r border-border bg-[#f8f9fa] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            {(["elements", "sections", "layers"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setLeftTab(t)}
                className={`flex-1 py-2 text-xs font-semibold capitalize transition ${leftTab === t ? "bg-white text-primary border-b-2 border-primary" : "text-muted hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {leftTab === "elements" && (
              <ElementPalette
                groups={ELEMENT_GROUPS}
                onAddToSection={(type) => {
                  if (selection.kind !== "page") {
                    addElement(selection.sectionId, content.sections.find((s) => s.id === selection.sectionId)!.columns[0].id, type);
                  } else {
                    const sec = content.sections[content.sections.length - 1];
                    addElement(sec.id, sec.columns[0].id, type);
                  }
                }}
              />
            )}
            {leftTab === "sections" && (
              <SectionPalette layouts={SECTION_LAYOUTS} onAdd={addSection} />
            )}
            {leftTab === "layers" && (
              <LayersPanel
                sections={content.sections}
                selection={selection}
                onSelect={setSelection}
              />
            )}
          </div>
        </div>

        {/* ── Canvas ──────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto bg-[#e8eaed]"
          onClick={() => setSelection({ kind: "page" })}
        >
          <div className="flex justify-center py-6 px-4">
            <div
              className="relative bg-white shadow-xl transition-all duration-300"
              style={{
                width: DEVICE_WIDTHS[device],
                minHeight: "600px",
                fontFamily: content.globalStyles.fontFamily,
                backgroundColor: content.globalStyles.bodyBackgroundColor,
              }}
            >
              {content.sections.map((section, secIdx) => (
                <CanvasSection
                  key={section.id}
                  section={section}
                  selection={selection}
                  isFirst={secIdx === 0}
                  isLast={secIdx === content.sections.length - 1}
                  onSelect={(sectionId) => setSelection({ kind: "section", sectionId })}
                  onSelectElement={(sectionId, colId, elementId) => setSelection({ kind: "element", sectionId, colId, elementId })}
                  onAddElement={addElement}
                  onDeleteElement={deleteElement}
                  onDuplicateElement={duplicateElement}
                  onMoveElementUp={moveElementUp}
                  onMoveElementDown={moveElementDown}
                  onDeleteSection={() => deleteSection(section.id)}
                  onDuplicateSection={() => duplicateSection(section.id)}
                  onMoveUp={() => moveSectionUp(section.id)}
                  onMoveDown={() => moveSectionDown(section.id)}
                  onElementDragStart={onElementDragStart}
                  onElementDrop={onElementDrop}
                />
              ))}

              {/* Add section button */}
              <div className="flex justify-center py-6">
                <button
                  onClick={(e) => { e.stopPropagation(); addSection("1col"); }}
                  className="flex items-center gap-2 rounded-full border-2 border-dashed border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-400 hover:border-primary hover:text-primary transition"
                >
                  <Plus size={16} /> Add Section
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Panel ─────────────────────────────────────────── */}
        <div className="w-[280px] shrink-0 overflow-y-auto border-l border-border bg-white">
          {selection.kind === "page" && (
            <PageSettingsPanel globalStyles={content.globalStyles} onChange={updateGlobalStyles} />
          )}
          {selection.kind === "section" && selectedSection && (
            <SectionSettingsPanel
              section={selectedSection}
              onUpdate={(patch) => updateSectionProps(selectedSection.id, patch)}
            />
          )}
          {selection.kind === "element" && selectedElement && selectedSection && (
            <ElementSettingsPanel
              element={selectedElement}
              availableForms={availableForms}
              onUpdate={(patch) => updateElement(selection.sectionId, selection.colId, selectedElement.id, patch)}
              onDelete={() => deleteElement(selection.sectionId, selection.colId, selectedElement.id)}
              onDuplicate={() => duplicateElement(selection.sectionId, selection.colId, selectedElement.id)}
              onMoveUp={() => moveElementUp(selection.sectionId, selection.colId, selectedElement.id)}
              onMoveDown={() => moveElementDown(selection.sectionId, selection.colId, selectedElement.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Element Palette ──────────────────────────────────────────────────────────

function ElementPalette({
  groups,
  onAddToSection,
}: {
  groups: typeof ELEMENT_GROUPS;
  onAddToSection: (type: ElementType) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/60">{g.label}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {g.items.map((item) => (
              <button
                key={item.type}
                onClick={() => onAddToSection(item.type)}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-border bg-white px-2 py-3 text-xs font-medium text-muted hover:border-primary hover:text-primary hover:bg-primary/5 transition"
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Section Palette ──────────────────────────────────────────────────────────

function SectionPalette({
  layouts,
  onAdd,
}: {
  layouts: typeof SECTION_LAYOUTS;
  onAdd: (layout: PageSection["layout"]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted/60">Add Section</p>
      {layouts.map((l) => (
        <button
          key={l.layout}
          onClick={() => onAdd(l.layout)}
          className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium hover:border-primary hover:bg-primary/5 transition"
        >
          <span>{l.label}</span>
          <span className="font-mono text-xs text-muted">{l.preview}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Layers Panel ─────────────────────────────────────────────────────────────

function LayersPanel({
  sections,
  selection,
  onSelect,
}: {
  sections: PageSection[];
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  return (
    <div className="space-y-1">
      {sections.map((s, i) => {
        const isSel = selection.kind !== "page" && selection.sectionId === s.id;
        return (
          <div key={s.id}>
            <button
              onClick={() => onSelect({ kind: "section", sectionId: s.id })}
              className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition ${isSel ? "bg-primary/10 text-primary" : "hover:bg-background text-muted"}`}
            >
              <span>§</span> Section {i + 1}
              <span className="ml-auto text-[10px] opacity-50">{s.layout}</span>
            </button>
            {s.columns.map((col) =>
              col.elements.map((el) => {
                const isElSel = selection.kind === "element" && selection.elementId === el.id;
                return (
                  <button
                    key={el.id}
                    onClick={(e) => { e.stopPropagation(); onSelect({ kind: "element", sectionId: s.id, colId: col.id, elementId: el.id }); }}
                    className={`flex w-full items-center gap-1.5 rounded py-1 pl-6 pr-2 text-xs transition ${isElSel ? "bg-primary/10 text-primary" : "text-muted hover:bg-background"}`}
                  >
                    <span className="capitalize">{el.type.replace(/_/g, " ")}</span>
                  </button>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Canvas Section ───────────────────────────────────────────────────────────

function CanvasSection({
  section, selection, isFirst, isLast,
  onSelect, onSelectElement, onAddElement,
  onDeleteElement, onDuplicateElement, onMoveElementUp, onMoveElementDown,
  onDeleteSection, onDuplicateSection, onMoveUp, onMoveDown,
  onElementDragStart, onElementDrop,
}: {
  section: PageSection;
  selection: Selection;
  isFirst: boolean;
  isLast: boolean;
  onSelect: (id: string) => void;
  onSelectElement: (s: string, c: string, e: string) => void;
  onAddElement: (sectionId: string, colId: string, type: ElementType) => void;
  onDeleteElement: (s: string, c: string, e: string) => void;
  onDuplicateElement: (s: string, c: string, e: string) => void;
  onMoveElementUp: (s: string, c: string, e: string) => void;
  onMoveElementDown: (s: string, c: string, e: string) => void;
  onDeleteSection: () => void;
  onDuplicateSection: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onElementDragStart: (s: string, c: string, e: string) => void;
  onElementDrop: (s: string, c: string, idx: number) => void;
}) {
  const isSelected = selection.kind !== "page" && selection.sectionId === section.id;
  const p = section.props;

  const sectionStyle: React.CSSProperties = {
    backgroundColor: p.backgroundColor || undefined,
    backgroundImage: p.backgroundImage ? `url(${p.backgroundImage})` : undefined,
    backgroundSize: p.backgroundSize,
    backgroundPosition: p.backgroundPosition,
    paddingTop: p.paddingTop,
    paddingBottom: p.paddingBottom,
    paddingLeft: p.fullWidth ? 0 : p.paddingLeft,
    paddingRight: p.fullWidth ? 0 : p.paddingRight,
    minHeight: p.minHeight || undefined,
  };

  const innerStyle: React.CSSProperties = p.fullWidth
    ? {}
    : { maxWidth: p.maxWidth, margin: "0 auto", paddingLeft: p.paddingLeft, paddingRight: p.paddingRight };

  return (
    <div
      className={`relative group/section transition ${isSelected ? "outline outline-2 outline-primary outline-offset-[-2px]" : "hover:outline hover:outline-1 hover:outline-primary/40 hover:outline-offset-[-1px]"}`}
      style={sectionStyle}
      onClick={(e) => { e.stopPropagation(); onSelect(section.id); }}
    >
      {/* Section toolbar */}
      {isSelected && (
        <div className="absolute -top-9 left-0 z-20 flex items-center gap-0.5 rounded-t-md bg-primary px-1.5 py-1">
          <span className="mr-1 text-[10px] font-medium text-white/80">Section</span>
          <Btn white onClick={(e) => { e.stopPropagation(); if (!isFirst) onMoveUp(); }} disabled={isFirst} title="Move up">↑</Btn>
          <Btn white onClick={(e) => { e.stopPropagation(); if (!isLast) onMoveDown(); }} disabled={isLast} title="Move down">↓</Btn>
          <Btn white onClick={(e) => { e.stopPropagation(); onDuplicateSection(); }} title="Duplicate"><Copy size={11} /></Btn>
          <Btn white onClick={(e) => { e.stopPropagation(); onDeleteSection(); }} title="Delete" className="hover:bg-red-500"><Trash2 size={11} /></Btn>
        </div>
      )}

      {/* Columns */}
      <div style={innerStyle}>
        <div className="flex gap-0" style={{ gap: 0 }}>
          {section.columns.map((col) => (
            <CanvasColumn
              key={col.id}
              col={col}
              section={section}
              selection={selection}
              onSelectElement={(colId, elId) => onSelectElement(section.id, colId, elId)}
              onAddElement={(type) => onAddElement(section.id, col.id, type)}
              onDeleteElement={(elId) => onDeleteElement(section.id, col.id, elId)}
              onDuplicateElement={(elId) => onDuplicateElement(section.id, col.id, elId)}
              onMoveUp={(elId) => onMoveElementUp(section.id, col.id, elId)}
              onMoveDown={(elId) => onMoveElementDown(section.id, col.id, elId)}
              onDragStart={(elId) => onElementDragStart(section.id, col.id, elId)}
              onDrop={(idx) => onElementDrop(section.id, col.id, idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Canvas Column ────────────────────────────────────────────────────────────

function CanvasColumn({
  col, section, selection,
  onSelectElement, onAddElement,
  onDeleteElement, onDuplicateElement, onMoveUp, onMoveDown,
  onDragStart, onDrop,
}: {
  col: PageColumn;
  section: PageSection;
  selection: Selection;
  onSelectElement: (colId: string, elId: string) => void;
  onAddElement: (type: ElementType) => void;
  onDeleteElement: (elId: string) => void;
  onDuplicateElement: (elId: string) => void;
  onMoveUp: (elId: string) => void;
  onMoveDown: (elId: string) => void;
  onDragStart: (elId: string) => void;
  onDrop: (idx: number) => void;
}) {
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  return (
    <div
      className="relative min-h-[40px] flex-1 border-[0.5px] border-transparent hover:border-dashed hover:border-primary/20 transition"
      style={{ width: `${col.widthPercent}%` }}
      onDragOver={(e) => { e.preventDefault(); setDragOverIdx(col.elements.length); }}
      onDrop={(e) => { e.preventDefault(); setDragOverIdx(null); onDrop(col.elements.length); }}
      onDragLeave={() => setDragOverIdx(null)}
    >
      {col.elements.length === 0 ? (
        <div
          className="flex min-h-16 items-center justify-center text-xs text-muted/40"
          onClick={(e) => { e.stopPropagation(); }}
        >
          Drop elements here
        </div>
      ) : (
        col.elements.map((el, idx) => {
          const isElSel = selection.kind === "element" && selection.elementId === el.id;
          return (
            <div
              key={el.id}
              className="relative"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIdx(idx); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIdx(null); onDrop(idx); }}
            >
              {dragOverIdx === idx && (
                <div className="h-1 rounded-full bg-primary/60 mx-2 mb-1" />
              )}
              <CanvasElement
                element={el}
                isSelected={isElSel}
                isFirst={idx === 0}
                isLast={idx === col.elements.length - 1}
                onSelect={() => onSelectElement(col.id, el.id)}
                onDelete={() => onDeleteElement(el.id)}
                onDuplicate={() => onDuplicateElement(el.id)}
                onMoveUp={() => onMoveUp(el.id)}
                onMoveDown={() => onMoveDown(el.id)}
                onDragStart={() => onDragStart(el.id)}
              />
            </div>
          );
        })
      )}
      {col.elements.length > 0 && dragOverIdx === col.elements.length && (
        <div className="h-1 rounded-full bg-primary/60 mx-2 mt-1" />
      )}
    </div>
  );
}

// ─── Canvas Element ───────────────────────────────────────────────────────────

function CanvasElement({
  element, isSelected, isFirst, isLast,
  onSelect, onDelete, onDuplicate, onMoveUp, onMoveDown, onDragStart,
}: {
  element: PageElement;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(); }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`group/el relative transition cursor-pointer ${isSelected ? "outline outline-2 outline-blue-500 outline-offset-1 z-10" : "hover:outline hover:outline-1 hover:outline-blue-400/50"}`}
    >
      {isSelected && (
        <div className="absolute -top-8 right-0 z-30 flex items-center gap-0.5 rounded-t bg-blue-500 px-1 py-0.5">
          <Btn white onClick={(e) => { e.stopPropagation(); if (!isFirst) onMoveUp(); }} disabled={isFirst} title="Up">↑</Btn>
          <Btn white onClick={(e) => { e.stopPropagation(); if (!isLast) onMoveDown(); }} disabled={isLast} title="Down">↓</Btn>
          <Btn white onClick={(e) => { e.stopPropagation(); onDuplicate(); }} title="Duplicate"><Copy size={10} /></Btn>
          <Btn white onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete" className="hover:bg-red-500"><Trash2 size={10} /></Btn>
          <div className="ml-1 cursor-grab text-white/80 px-1"><GripVertical size={10} /></div>
        </div>
      )}
      <ElementRenderer element={element} />
    </div>
  );
}

// ─── Element Renderer (actual visual) ────────────────────────────────────────

function ElementRenderer({ element }: { element: PageElement }) {
  const p = element.props;

  switch (element.type) {
    case "headline":
      const Tag = (p.tag as "h1") ?? "h2";
      return (
        <Tag style={{
          fontSize: p.fontSize as number,
          fontWeight: p.fontWeight as string,
          color: p.color as string,
          textAlign: p.textAlign as "left",
          lineHeight: p.lineHeight as number,
          paddingTop: p.paddingTop as number,
          paddingBottom: p.paddingBottom as number,
          paddingLeft: p.paddingLeft as number,
          paddingRight: p.paddingRight as number,
          marginTop: p.marginTop as number,
          marginBottom: p.marginBottom as number,
        }}>
          {(p.text as string) || "Headline"}
        </Tag>
      );

    case "paragraph":
      return (
        <p style={{
          fontSize: p.fontSize as number,
          lineHeight: p.lineHeight as number,
          color: p.color as string,
          textAlign: p.textAlign as "left",
          maxWidth: p.maxWidth ? `${p.maxWidth}px` : undefined,
          margin: p.maxWidth ? "0 auto" : undefined,
          paddingTop: p.paddingTop as number,
          paddingBottom: p.paddingBottom as number,
          marginTop: p.marginTop as number,
          marginBottom: p.marginBottom as number,
          whiteSpace: "pre-wrap",
        }}>
          {(p.text as string) || "Paragraph text goes here."}
        </p>
      );

    case "button":
      return (
        <div style={{ textAlign: p.alignment as "center", marginTop: p.marginTop as number, marginBottom: p.marginBottom as number }}>
          <span style={{
            display: p.fullWidth ? "block" : "inline-block",
            backgroundColor: p.backgroundColor as string,
            color: p.textColor as string,
            fontSize: p.fontSize as number,
            fontWeight: p.fontWeight as string,
            borderRadius: p.borderRadius as number,
            paddingTop: p.paddingTop as number,
            paddingBottom: p.paddingBottom as number,
            paddingLeft: p.paddingLeft as number,
            paddingRight: p.paddingRight as number,
            cursor: "pointer",
          }}>
            {(p.text as string) || "Button"}
          </span>
        </div>
      );

    case "image":
      return (
        <div style={{ textAlign: p.alignment as "center", marginTop: p.marginTop as number, marginBottom: p.marginBottom as number }}>
          <img
            src={p.src as string}
            alt={(p.alt as string) || ""}
            style={{
              width: `${p.width}%`,
              borderRadius: p.borderRadius as number,
              display: "inline-block",
              boxShadow: p.boxShadow as string,
            }}
          />
        </div>
      );

    case "video": {
      const url = (p.url as string) || "";
      let embedUrl = "";
      if (url.includes("youtube.com") || url.includes("youtu.be")) {
        const id = url.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] ?? "";
        embedUrl = `https://www.youtube.com/embed/${id}`;
      } else if (url.includes("vimeo.com")) {
        const id = url.match(/vimeo\.com\/(\d+)/)?.[1] ?? "";
        embedUrl = `https://player.vimeo.com/video/${id}`;
      }
      return (
        <div style={{ marginTop: p.marginTop as number, marginBottom: p.marginBottom as number, borderRadius: p.borderRadius as number, overflow: "hidden" }}>
          {embedUrl ? (
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe src={embedUrl} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} allowFullScreen />
            </div>
          ) : (
            <div style={{ background: "#111", height: 200, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: p.borderRadius as number }}>
              <span style={{ color: "#fff", opacity: 0.4, fontSize: 14 }}>Add video URL in properties</span>
            </div>
          )}
        </div>
      );
    }

    case "divider":
      return (
        <div style={{ marginTop: p.marginTop as number, marginBottom: p.marginBottom as number, display: "flex", justifyContent: "center" }}>
          <hr style={{ borderColor: p.color as string, borderTopWidth: p.thickness as number, width: `${p.width}%`, margin: 0 }} />
        </div>
      );

    case "spacer":
      return <div style={{ height: p.height as number }} />;

    case "icon_list": {
      const items = (p.items as { icon: string; text: string }[]) ?? [];
      return (
        <div style={{ marginTop: p.marginTop as number, marginBottom: p.marginBottom as number }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: p.gap as number }}>
              <span style={{ color: p.iconColor as string, fontWeight: 700, fontSize: 18, lineHeight: 1.4 }}>{item.icon}</span>
              <span style={{ fontSize: p.fontSize as number, lineHeight: 1.6, color: "#333" }}>{item.text}</span>
            </div>
          ))}
        </div>
      );
    }

    case "countdown": {
      return (
        <div style={{
          backgroundColor: p.backgroundColor as string,
          color: p.textColor as string,
          display: "flex",
          justifyContent: "center",
          gap: 20,
          padding: "20px 30px",
          borderRadius: 8,
          marginTop: p.marginTop as number,
          marginBottom: p.marginBottom as number,
        }}>
          {["00", "00", "00", "00"].map((v, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: p.digitSize as number, fontWeight: 700, lineHeight: 1 }}>{v}</div>
              {!!p.showLabels && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{["Days", "Hours", "Mins", "Secs"][i]}</div>}
            </div>
          ))}
        </div>
      );
    }

    case "form_embed":
      return (
        <div style={{ border: "2px dashed #e5e7eb", borderRadius: 8, padding: "24px", textAlign: "center", color: "#9ca3af" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{(p.formName as string) || "Select a form"}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Form will render here on the live page</div>
        </div>
      );

    case "html":
      return (
        <div
          dangerouslySetInnerHTML={{ __html: (p.html as string) || "" }}
          style={{ marginTop: p.marginTop as number, marginBottom: p.marginBottom as number }}
        />
      );

    default:
      return null;
  }
}

// ─── Page Preview ─────────────────────────────────────────────────────────────

function PagePreview({ content }: { content: PageContent }) {
  return (
    <div style={{ fontFamily: content.globalStyles.fontFamily, backgroundColor: content.globalStyles.bodyBackgroundColor }}>
      {content.sections.map((section) => {
        const p = section.props;
        return (
          <div key={section.id} style={{
            backgroundColor: p.backgroundColor,
            backgroundImage: p.backgroundImage ? `url(${p.backgroundImage})` : undefined,
            backgroundSize: p.backgroundSize,
            backgroundPosition: p.backgroundPosition,
            paddingTop: p.paddingTop,
            paddingBottom: p.paddingBottom,
            paddingLeft: p.fullWidth ? 0 : p.paddingLeft,
            paddingRight: p.fullWidth ? 0 : p.paddingRight,
            minHeight: p.minHeight || undefined,
          }}>
            <div style={p.fullWidth ? {} : { maxWidth: p.maxWidth, margin: "0 auto", paddingLeft: p.paddingLeft, paddingRight: p.paddingRight }}>
              <div style={{ display: "flex" }}>
                {section.columns.map((col) => (
                  <div key={col.id} style={{ width: `${col.widthPercent}%` }}>
                    {col.elements.map((el) => <ElementRenderer key={el.id} element={el} />)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings Panels ──────────────────────────────────────────────────────────

function PageSettingsPanel({ globalStyles, onChange }: { globalStyles: PageContent["globalStyles"]; onChange: (p: Partial<PageContent["globalStyles"]>) => void }) {
  return (
    <PanelWrapper title="Page Settings">
      <PropGroup label="Background">
        <ColorProp label="Body BG" value={globalStyles.bodyBackgroundColor} onChange={(v) => onChange({ bodyBackgroundColor: v })} />
      </PropGroup>
      <PropGroup label="Typography">
        <SelectProp
          label="Font Family"
          value={globalStyles.fontFamily}
          options={["system-ui, sans-serif", "Georgia, serif", "Helvetica, sans-serif", "'Inter', sans-serif", "'Roboto', sans-serif", "monospace"]}
          onChange={(v) => onChange({ fontFamily: v })}
        />
      </PropGroup>
    </PanelWrapper>
  );
}

function SectionSettingsPanel({ section, onUpdate }: { section: PageSection; onUpdate: (p: Partial<PageSection["props"]>) => void }) {
  const p = section.props;
  return (
    <PanelWrapper title="Section Settings">
      <PropGroup label="Background">
        <ColorProp label="Color" value={p.backgroundColor} onChange={(v) => onUpdate({ backgroundColor: v })} />
        <TextProp label="Image URL" value={p.backgroundImage} placeholder="https://..." onChange={(v) => onUpdate({ backgroundImage: v })} />
        <SelectProp label="BG Size" value={p.backgroundSize} options={["cover", "contain", "auto"]} onChange={(v) => onUpdate({ backgroundSize: v })} />
      </PropGroup>
      <PropGroup label="Spacing">
        <SpacingProp
          topLabel="Padding Top" top={p.paddingTop}
          bottomLabel="Padding Bottom" bottom={p.paddingBottom}
          onChangeTop={(v) => onUpdate({ paddingTop: v })}
          onChangeBottom={(v) => onUpdate({ paddingBottom: v })}
        />
      </PropGroup>
      <PropGroup label="Layout">
        <NumberProp label="Max Width" value={p.maxWidth} min={300} max={1600} onChange={(v) => onUpdate({ maxWidth: v })} />
        <NumberProp label="Min Height (px)" value={p.minHeight} min={0} max={1200} onChange={(v) => onUpdate({ minHeight: v })} />
        <ToggleProp label="Full Width" value={p.fullWidth} onChange={(v) => onUpdate({ fullWidth: v })} />
      </PropGroup>
    </PanelWrapper>
  );
}

function ElementSettingsPanel({
  element, availableForms, onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown,
}: {
  element: PageElement;
  availableForms: { id: string; name: string }[];
  onUpdate: (p: Partial<Record<string, unknown>>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const p = element.props;
  const type = element.type;

  return (
    <PanelWrapper title={type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}>
      {/* Element actions */}
      <div className="flex gap-1 mb-4">
        <button onClick={onMoveUp} className="flex-1 rounded border border-border py-1 text-xs text-muted hover:bg-background transition">↑ Up</button>
        <button onClick={onMoveDown} className="flex-1 rounded border border-border py-1 text-xs text-muted hover:bg-background transition">↓ Down</button>
        <button onClick={onDuplicate} className="flex-1 rounded border border-border py-1 text-xs text-muted hover:bg-background transition">⧉ Dupe</button>
        <button onClick={onDelete} className="flex-1 rounded border border-red-200 py-1 text-xs text-red-500 hover:bg-red-50 transition">✕</button>
      </div>

      {type === "headline" && <>
        <PropGroup label="Content">
          <TextareaProp label="Text" value={p.text as string} onChange={(v) => onUpdate({ text: v })} rows={3} />
          <SelectProp label="Tag" value={p.tag as string} options={["h1","h2","h3","h4","h5","h6"]} onChange={(v) => onUpdate({ tag: v })} />
        </PropGroup>
        <PropGroup label="Style">
          <NumberProp label="Font Size" value={p.fontSize as number} min={12} max={120} onChange={(v) => onUpdate({ fontSize: v })} />
          <SelectProp label="Font Weight" value={String(p.fontWeight)} options={["300","400","500","600","700","800","900"]} labels={["Light","Regular","Medium","Semi Bold","Bold","Extra Bold","Black"]} onChange={(v) => onUpdate({ fontWeight: v })} />
          <ColorProp label="Color" value={p.color as string} onChange={(v) => onUpdate({ color: v })} />
          <AlignProp value={p.textAlign as string} onChange={(v) => onUpdate({ textAlign: v })} />
          <NumberProp label="Line Height" value={(p.lineHeight as number) * 10} min={8} max={30} onChange={(v) => onUpdate({ lineHeight: v / 10 })} />
        </PropGroup>
        <PropGroup label="Spacing">
          <NumberProp label="Margin Top" value={p.marginTop as number} min={0} max={200} onChange={(v) => onUpdate({ marginTop: v })} />
          <NumberProp label="Margin Bottom" value={p.marginBottom as number} min={0} max={200} onChange={(v) => onUpdate({ marginBottom: v })} />
        </PropGroup>
      </>}

      {type === "paragraph" && <>
        <PropGroup label="Content">
          <TextareaProp label="Text" value={p.text as string} onChange={(v) => onUpdate({ text: v })} rows={6} />
        </PropGroup>
        <PropGroup label="Style">
          <NumberProp label="Font Size" value={p.fontSize as number} min={10} max={48} onChange={(v) => onUpdate({ fontSize: v })} />
          <NumberProp label="Line Height" value={(p.lineHeight as number) * 10} min={10} max={30} onChange={(v) => onUpdate({ lineHeight: v / 10 })} />
          <ColorProp label="Color" value={p.color as string} onChange={(v) => onUpdate({ color: v })} />
          <AlignProp value={p.textAlign as string} onChange={(v) => onUpdate({ textAlign: v })} />
          <NumberProp label="Max Width (px)" value={p.maxWidth as number || 0} min={0} max={1200} onChange={(v) => onUpdate({ maxWidth: v || "" })} />
        </PropGroup>
        <PropGroup label="Spacing">
          <NumberProp label="Margin Top" value={p.marginTop as number} min={0} max={200} onChange={(v) => onUpdate({ marginTop: v })} />
          <NumberProp label="Margin Bottom" value={p.marginBottom as number} min={0} max={200} onChange={(v) => onUpdate({ marginBottom: v })} />
        </PropGroup>
      </>}

      {type === "button" && <>
        <PropGroup label="Content">
          <TextProp label="Button Text" value={p.text as string} onChange={(v) => onUpdate({ text: v })} />
          <TextProp label="URL" value={p.url as string} placeholder="https://..." onChange={(v) => onUpdate({ url: v })} />
          <ToggleProp label="Open in new tab" value={p.newTab as boolean} onChange={(v) => onUpdate({ newTab: v })} />
        </PropGroup>
        <PropGroup label="Style">
          <ColorProp label="Background" value={p.backgroundColor as string} onChange={(v) => onUpdate({ backgroundColor: v })} />
          <ColorProp label="Text Color" value={p.textColor as string} onChange={(v) => onUpdate({ textColor: v })} />
          <NumberProp label="Font Size" value={p.fontSize as number} min={10} max={32} onChange={(v) => onUpdate({ fontSize: v })} />
          <SelectProp label="Font Weight" value={String(p.fontWeight)} options={["400","500","600","700","800"]} labels={["Regular","Medium","Semi Bold","Bold","Extra Bold"]} onChange={(v) => onUpdate({ fontWeight: v })} />
          <NumberProp label="Border Radius" value={p.borderRadius as number} min={0} max={60} onChange={(v) => onUpdate({ borderRadius: v })} />
          <ToggleProp label="Full Width" value={p.fullWidth as boolean} onChange={(v) => onUpdate({ fullWidth: v })} />
          <AlignProp value={p.alignment as string} onChange={(v) => onUpdate({ alignment: v })} />
        </PropGroup>
        <PropGroup label="Spacing">
          <SpacingProp topLabel="Pad Top" top={p.paddingTop as number} bottomLabel="Pad Bottom" bottom={p.paddingBottom as number} onChangeTop={(v) => onUpdate({ paddingTop: v })} onChangeBottom={(v) => onUpdate({ paddingBottom: v })} />
          <NumberProp label="Margin Top" value={p.marginTop as number} min={0} max={200} onChange={(v) => onUpdate({ marginTop: v })} />
          <NumberProp label="Margin Bottom" value={p.marginBottom as number} min={0} max={200} onChange={(v) => onUpdate({ marginBottom: v })} />
        </PropGroup>
      </>}

      {type === "image" && <>
        <PropGroup label="Content">
          <TextProp label="Image URL" value={p.src as string} placeholder="https://..." onChange={(v) => onUpdate({ src: v })} />
          <TextProp label="Alt Text" value={p.alt as string} placeholder="Describe image" onChange={(v) => onUpdate({ alt: v })} />
          <TextProp label="Link URL" value={p.url as string} placeholder="https://..." onChange={(v) => onUpdate({ url: v })} />
          <ToggleProp label="Open in new tab" value={p.newTab as boolean} onChange={(v) => onUpdate({ newTab: v })} />
        </PropGroup>
        <PropGroup label="Style">
          <NumberProp label="Width %" value={p.width as number} min={10} max={100} onChange={(v) => onUpdate({ width: v })} />
          <NumberProp label="Border Radius" value={p.borderRadius as number} min={0} max={60} onChange={(v) => onUpdate({ borderRadius: v })} />
          <AlignProp value={p.alignment as string} onChange={(v) => onUpdate({ alignment: v })} />
          <SelectProp label="Box Shadow" value={p.boxShadow as string} options={["none","0 2px 8px rgba(0,0,0,0.12)","0 4px 24px rgba(0,0,0,0.18)","0 8px 40px rgba(0,0,0,0.22)"]} labels={["None","Small","Medium","Large"]} onChange={(v) => onUpdate({ boxShadow: v })} />
        </PropGroup>
        <PropGroup label="Spacing">
          <NumberProp label="Margin Top" value={p.marginTop as number} min={0} max={200} onChange={(v) => onUpdate({ marginTop: v })} />
          <NumberProp label="Margin Bottom" value={p.marginBottom as number} min={0} max={200} onChange={(v) => onUpdate({ marginBottom: v })} />
        </PropGroup>
      </>}

      {type === "video" && <>
        <PropGroup label="Content">
          <TextProp label="Video URL" value={p.url as string} placeholder="YouTube or Vimeo URL" onChange={(v) => onUpdate({ url: v })} />
        </PropGroup>
        <PropGroup label="Style">
          <NumberProp label="Border Radius" value={p.borderRadius as number} min={0} max={40} onChange={(v) => onUpdate({ borderRadius: v })} />
        </PropGroup>
        <PropGroup label="Spacing">
          <NumberProp label="Margin Top" value={p.marginTop as number} min={0} max={200} onChange={(v) => onUpdate({ marginTop: v })} />
          <NumberProp label="Margin Bottom" value={p.marginBottom as number} min={0} max={200} onChange={(v) => onUpdate({ marginBottom: v })} />
        </PropGroup>
      </>}

      {type === "divider" && <>
        <PropGroup label="Style">
          <ColorProp label="Color" value={p.color as string} onChange={(v) => onUpdate({ color: v })} />
          <NumberProp label="Thickness (px)" value={p.thickness as number} min={1} max={10} onChange={(v) => onUpdate({ thickness: v })} />
          <NumberProp label="Width %" value={p.width as number} min={10} max={100} onChange={(v) => onUpdate({ width: v })} />
        </PropGroup>
        <PropGroup label="Spacing">
          <NumberProp label="Margin Top" value={p.marginTop as number} min={0} max={200} onChange={(v) => onUpdate({ marginTop: v })} />
          <NumberProp label="Margin Bottom" value={p.marginBottom as number} min={0} max={200} onChange={(v) => onUpdate({ marginBottom: v })} />
        </PropGroup>
      </>}

      {type === "spacer" && <>
        <PropGroup label="Style">
          <NumberProp label="Height (px)" value={p.height as number} min={10} max={400} onChange={(v) => onUpdate({ height: v })} />
        </PropGroup>
      </>}

      {type === "icon_list" && <>
        <PropGroup label="Items">
          <div className="space-y-2">
            {((p.items as { icon: string; text: string }[]) ?? []).map((item, i) => (
              <div key={i} className="flex gap-1.5">
                <input
                  className="w-10 rounded border border-border px-1 py-1 text-center text-xs"
                  value={item.icon}
                  onChange={(e) => {
                    const next = [...(p.items as { icon: string; text: string }[])];
                    next[i] = { ...next[i], icon: e.target.value };
                    onUpdate({ items: next });
                  }}
                />
                <input
                  className="flex-1 rounded border border-border px-2 py-1 text-xs"
                  value={item.text}
                  onChange={(e) => {
                    const next = [...(p.items as { icon: string; text: string }[])];
                    next[i] = { ...next[i], text: e.target.value };
                    onUpdate({ items: next });
                  }}
                />
                <button
                  onClick={() => {
                    const next = (p.items as { icon: string; text: string }[]).filter((_, j) => j !== i);
                    onUpdate({ items: next });
                  }}
                  className="rounded px-1 text-muted hover:text-red-500 transition"
                ><X size={12} /></button>
              </div>
            ))}
            <button
              onClick={() => onUpdate({ items: [...((p.items as { icon: string; text: string }[]) ?? []), { icon: "✓", text: "New item" }] })}
              className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-border py-1.5 text-xs text-muted hover:text-foreground transition"
            >
              <Plus size={11} /> Add item
            </button>
          </div>
        </PropGroup>
        <PropGroup label="Style">
          <ColorProp label="Icon Color" value={p.iconColor as string} onChange={(v) => onUpdate({ iconColor: v })} />
          <NumberProp label="Font Size" value={p.fontSize as number} min={10} max={32} onChange={(v) => onUpdate({ fontSize: v })} />
          <NumberProp label="Item Gap (px)" value={p.gap as number} min={4} max={40} onChange={(v) => onUpdate({ gap: v })} />
        </PropGroup>
      </>}

      {type === "countdown" && <>
        <PropGroup label="Content">
          <div>
            <label className="block text-xs text-muted mb-1">End Date & Time</label>
            <input type="datetime-local" className="w-full rounded border border-border px-2 py-1.5 text-xs" value={p.endDate as string} onChange={(e) => onUpdate({ endDate: e.target.value })} />
          </div>
          <ToggleProp label="Show Labels" value={p.showLabels as boolean} onChange={(v) => onUpdate({ showLabels: v })} />
        </PropGroup>
        <PropGroup label="Style">
          <ColorProp label="Background" value={p.backgroundColor as string} onChange={(v) => onUpdate({ backgroundColor: v })} />
          <ColorProp label="Text Color" value={p.textColor as string} onChange={(v) => onUpdate({ textColor: v })} />
          <NumberProp label="Digit Size" value={p.digitSize as number} min={24} max={96} onChange={(v) => onUpdate({ digitSize: v })} />
        </PropGroup>
      </>}

      {type === "form_embed" && <>
        <PropGroup label="Form">
          <div>
            <label className="block text-xs text-muted mb-1">Select Form</label>
            <select
              className="w-full rounded border border-border px-2 py-1.5 text-sm"
              value={p.formId as string}
              onChange={(e) => {
                const form = availableForms.find((f) => f.id === e.target.value);
                onUpdate({ formId: e.target.value, formName: form?.name ?? "" });
              }}
            >
              <option value="">— Choose form —</option>
              {availableForms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <TextProp label="Submit Button Text" value={p.buttonText as string} onChange={(v) => onUpdate({ buttonText: v })} />
          <ColorProp label="Button Color" value={p.buttonColor as string} onChange={(v) => onUpdate({ buttonColor: v })} />
        </PropGroup>
      </>}

      {type === "html" && <>
        <PropGroup label="Content">
          <TextareaProp label="HTML" value={p.html as string} onChange={(v) => onUpdate({ html: v })} rows={8} mono />
          <TextareaProp label="CSS (optional)" value={p.css as string} onChange={(v) => onUpdate({ css: v })} rows={4} mono />
        </PropGroup>
      </>}
    </PanelWrapper>
  );
}

// ─── Panel Primitives ─────────────────────────────────────────────────────────

function PanelWrapper({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 space-y-1">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted/60">{title}</p>
      {children}
    </div>
  );
}

function PropGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-3 rounded-lg border border-border overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold bg-background hover:bg-background/80 transition">
        {label} <ChevronDown size={12} className={`transition ${open ? "rotate-0" : "-rotate-90"}`} />
      </button>
      {open && <div className="px-3 py-2 space-y-2 bg-white">{children}</div>}
    </div>
  );
}

function TextProp({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-muted mb-0.5">{label}</label>
      <input className="w-full rounded border border-border px-2 py-1.5 text-xs" value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextareaProp({ label, value, onChange, rows = 3, mono }: { label: string; value: string; onChange: (v: string) => void; rows?: number; mono?: boolean }) {
  return (
    <div>
      <label className="block text-[10px] text-muted mb-0.5">{label}</label>
      <textarea className={`w-full rounded border border-border px-2 py-1.5 text-xs resize-none ${mono ? "font-mono" : ""}`} value={value ?? ""} rows={rows} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function NumberProp({ label, value, min, max, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <label className="text-[10px] text-muted">{label}</label>
        <span className="text-[10px] font-mono text-muted">{value}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input type="range" min={min ?? 0} max={max ?? 200} value={value ?? 0} onChange={(e) => onChange(+e.target.value)} className="flex-1 h-1 accent-primary" />
        <input type="number" min={min ?? 0} max={max ?? 200} value={value ?? 0} onChange={(e) => onChange(+e.target.value)} className="w-12 rounded border border-border px-1 py-1 text-xs text-right" />
      </div>
    </div>
  );
}

function ColorProp({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-[10px] text-muted">{label}</label>
      <div className="flex items-center gap-1.5">
        <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} className="h-6 w-6 cursor-pointer rounded border border-border" />
        <input className="w-20 rounded border border-border px-1.5 py-0.5 text-[10px] font-mono" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function SelectProp({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-muted mb-0.5">{label}</label>
      <select className="w-full rounded border border-border px-2 py-1.5 text-xs" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {options.map((o, i) => <option key={o} value={o}>{labels?.[i] ?? o}</option>)}
      </select>
    </div>
  );
}

function ToggleProp({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-[10px] text-muted">{label}</span>
      <div onClick={() => onChange(!value)} className={`relative h-5 w-9 rounded-full transition ${value ? "bg-primary" : "bg-gray-200"}`}>
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${value ? "left-4" : "left-0.5"}`} />
      </div>
    </label>
  );
}

function AlignProp({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] text-muted mb-0.5">Alignment</label>
      <div className="flex rounded-lg border border-border overflow-hidden">
        {(["left", "center", "right"] as const).map((a) => {
          const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
          return (
            <button key={a} onClick={() => onChange(a)} className={`flex flex-1 items-center justify-center py-1.5 transition ${value === a ? "bg-primary/10 text-primary" : "text-muted hover:bg-background"}`}>
              <Icon size={12} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpacingProp({ topLabel, top, bottomLabel, bottom, onChangeTop, onChangeBottom }: { topLabel: string; top: number; bottomLabel: string; bottom: number; onChangeTop: (v: number) => void; onChangeBottom: (v: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-[10px] text-muted mb-0.5">{topLabel}</label>
        <input type="number" min={0} max={300} value={top ?? 0} onChange={(e) => onChangeTop(+e.target.value)} className="w-full rounded border border-border px-2 py-1 text-xs" />
      </div>
      <div>
        <label className="block text-[10px] text-muted mb-0.5">{bottomLabel}</label>
        <input type="number" min={0} max={300} value={bottom ?? 0} onChange={(e) => onChangeBottom(+e.target.value)} className="w-full rounded border border-border px-2 py-1 text-xs" />
      </div>
    </div>
  );
}

// ─── Shared Button ────────────────────────────────────────────────────────────

function Btn({ children, onClick, disabled, title, white, className }: { children: React.ReactNode; onClick?: (e: React.MouseEvent) => void; disabled?: boolean; title?: string; white?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex size-5 items-center justify-center rounded transition disabled:opacity-30 ${white ? "text-white hover:bg-white/20" : "text-muted hover:bg-background"} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
