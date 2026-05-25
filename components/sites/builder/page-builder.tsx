"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import {
  BLOCK_CATALOG,
  type Block,
  type PageSchema,
  type Theme,
} from "@/lib/sites/schema";
import { savePageDraft, publishPage } from "@/app/(dashboard)/sites/[siteId]/pages/[pageId]/builder/actions";
import { BuilderTopbar } from "@/components/sites/builder/topbar";
import { BlockLibrary } from "@/components/sites/builder/block-library";
import { BuilderCanvas } from "@/components/sites/builder/canvas";
import { BlockInspector, ColorField, SelectField, TextField } from "@/components/sites/builder/inspector";
import { BlockIcon } from "@/components/sites/builder/icons";

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `blk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function cloneBlockWithNewIds(block: Block): Block {
  const clone = structuredClone(block);
  clone.id = uid();
  if (clone.type === "featureGrid") clone.features = clone.features.map((f) => ({ ...f, id: uid() }));
  if (clone.type === "form") clone.fields = clone.fields.map((f) => ({ ...f, id: uid() }));
  return clone;
}

const BLOCK_LABELS: Record<Block["type"], { label: string; icon: string }> = BLOCK_CATALOG.reduce(
  (acc, entry) => {
    acc[entry.type] = { label: entry.label, icon: entry.icon };
    return acc;
  },
  {} as Record<Block["type"], { label: string; icon: string }>,
);

export function PageBuilder({
  pageId,
  initialSchema,
  initialTitle,
  initialSlug,
  previewUrl,
  backHref,
}: {
  pageId: string;
  siteId: string;
  initialSchema: PageSchema;
  initialTitle: string;
  initialSlug: string;
  previewUrl: string;
  backHref: string;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialSchema.blocks);
  const [theme, setTheme] = useState<Theme>(initialSchema.theme);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState(initialTitle);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;

  // Keep a ref so the keyboard shortcut always saves the latest state.
  const stateRef = useRef({ blocks, theme });
  stateRef.current = { blocks, theme };

  const buildSchema = useCallback((): PageSchema => {
    return { version: 1, theme: stateRef.current.theme, blocks: stateRef.current.blocks };
  }, []);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 3500);
  }

  const handleSaveDraft = useCallback(async () => {
    setIsSaving(true);
    try {
      await savePageDraft(pageId, buildSchema());
      setIsDirty(false);
      showToast("success", "Draft saved.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setIsSaving(false);
    }
  }, [pageId, buildSchema]);

  async function handlePublish() {
    setIsPublishing(true);
    try {
      // Save current state first so we publish exactly what is on screen.
      await savePageDraft(pageId, buildSchema());
      await publishPage(pageId);
      setIsDirty(false);
      showToast("success", "Page published.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to publish page.");
    } finally {
      setIsPublishing(false);
    }
  }

  // Cmd/Ctrl+S saves the draft.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSaveDraft();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSaveDraft]);

  function markDirty() {
    setIsDirty(true);
  }

  function handleAddBlock(block: Block) {
    setBlocks((prev) => [...prev, block]);
    setSelectedId(block.id);
    markDirty();
  }

  function handleBlocksChange(next: Block[]) {
    setBlocks(next);
    markDirty();
  }

  function handleBlockUpdate(updated: Block) {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    markDirty();
  }

  function handleDelete(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
    markDirty();
  }

  function handleDuplicate(id: string) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const copy = cloneBlockWithNewIds(prev[idx]);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    markDirty();
  }

  function updateTheme(changes: Partial<Theme>) {
    setTheme((prev) => ({ ...prev, ...changes }));
    markDirty();
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <BuilderTopbar
        pageTitle={pageTitle}
        slug={initialSlug}
        isDirty={isDirty}
        isSaving={isSaving}
        isPublishing={isPublishing}
        onTitleChange={setPageTitle}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onPreview={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
        backHref={backHref}
      />

      <div className="flex min-h-0 flex-1">
        {/* Left panel */}
        <aside className="flex w-[260px] shrink-0 flex-col overflow-y-auto border-r border-border bg-panel">
          <div className="border-b border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Blocks</p>
            <BlockLibrary onAdd={handleAddBlock} />
          </div>
          <div className="p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Layers</p>
            {blocks.length === 0 ? (
              <p className="text-xs text-muted">No blocks yet.</p>
            ) : (
              <ol className="flex flex-col gap-0.5">
                {blocks.map((b, i) => {
                  const meta = BLOCK_LABELS[b.type];
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(b.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                          selectedId === b.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-background"
                        }`}
                      >
                        <GripVertical size={12} className="text-muted/50" />
                        <BlockIcon name={meta.icon} size={13} />
                        <span className="truncate">{meta.label}</span>
                        <span className="ml-auto text-[10px] text-muted">{i + 1}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>

        {/* Center canvas */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-background">
          <BuilderCanvas
            blocks={blocks}
            theme={theme}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onBlocksChange={handleBlocksChange}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        </main>

        {/* Right panel */}
        <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-border bg-panel">
          {selectedBlock ? (
            <>
              <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <BlockIcon name={BLOCK_LABELS[selectedBlock.type].icon} size={14} className="text-primary" />
                <span className="text-sm font-semibold">{BLOCK_LABELS[selectedBlock.type].label}</span>
              </div>
              <BlockInspector block={selectedBlock} onChange={handleBlockUpdate} />
            </>
          ) : (
            <div className="flex flex-col">
              <div className="border-b border-border px-3 py-2.5">
                <span className="text-sm font-semibold">Page settings</span>
              </div>
              <div className="flex flex-col gap-3 p-3">
                <TextField label="Font family" value={theme.fontFamily} onChange={(v) => updateTheme({ fontFamily: v })} />
                <ColorField label="Primary color" value={theme.primaryColor} onChange={(v) => updateTheme({ primaryColor: v })} />
                <ColorField label="Background" value={theme.backgroundColor} onChange={(v) => updateTheme({ backgroundColor: v })} />
                <ColorField label="Text color" value={theme.textColor} onChange={(v) => updateTheme({ textColor: v })} />
                <SelectField
                  label="Border radius"
                  value={theme.borderRadius}
                  options={[
                    { value: "none", label: "None" },
                    { value: "sm", label: "Small" },
                    { value: "md", label: "Medium" },
                    { value: "lg", label: "Large" },
                  ]}
                  onChange={(v) => updateTheme({ borderRadius: v })}
                />
                <p className="text-xs text-muted">Select a block on the canvas to edit its content.</p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {toast ? (
        <div
          className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toast.kind === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
