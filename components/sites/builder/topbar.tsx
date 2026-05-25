"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowLeft, Eye, Loader2, Rocket, Save } from "lucide-react";

export function BuilderTopbar({
  pageTitle,
  slug,
  isDirty,
  isSaving,
  isPublishing,
  onTitleChange,
  onSaveDraft,
  onPublish,
  onPreview,
  backHref,
}: {
  pageTitle: string;
  slug: string;
  isDirty: boolean;
  isSaving: boolean;
  isPublishing: boolean;
  onTitleChange: (value: string) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onPreview: () => void;
  backHref: string;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-panel px-4">
      <Link
        href={backHref as Route}
        className="flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-background hover:text-foreground"
        aria-label="Back"
      >
        <ArrowLeft size={18} />
      </Link>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          value={pageTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          className="min-w-0 max-w-xs truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none transition hover:border-border focus:border-primary"
          aria-label="Page title"
        />
        <span className="hidden truncate font-mono text-xs text-muted sm:inline">/{slug}</span>
        {isDirty ? (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
            Unsaved
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-background"
        >
          <Eye size={15} />
          Preview
        </button>

        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-background disabled:cursor-wait disabled:opacity-70"
        >
          {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {isSaving ? "Saving…" : "Save Draft"}
        </button>

        <button
          type="button"
          onClick={onPublish}
          disabled={isPublishing}
          className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70"
        >
          {isPublishing ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
          {isPublishing ? "Publishing…" : "Publish"}
        </button>
      </div>
    </header>
  );
}
