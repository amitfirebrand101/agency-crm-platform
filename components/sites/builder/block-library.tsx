"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { BLOCK_CATALOG, makeBlock, type Block, type BlockCategory } from "@/lib/sites/schema";
import { BlockIcon } from "@/components/sites/builder/icons";

const CATEGORY_ORDER: BlockCategory[] = ["Layout", "Content", "Media", "Interactive"];

export function BlockLibrary({ onAdd }: { onAdd: (block: Block) => void }) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = BLOCK_CATALOG.filter(
      (entry) =>
        !q ||
        entry.label.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.type.toLowerCase().includes(q),
    );
    return CATEGORY_ORDER.map((category) => ({
      category,
      entries: filtered.filter((e) => e.category === category),
    })).filter((g) => g.entries.length > 0);
  }, [query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search blocks…"
          className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm outline-none ring-primary/20 focus:ring-4"
        />
      </div>

      {grouped.length === 0 ? (
        <p className="px-1 py-4 text-center text-xs text-muted">No blocks match &ldquo;{query}&rdquo;.</p>
      ) : (
        grouped.map((group) => (
          <div key={group.category} className="flex flex-col gap-1.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{group.category}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {group.entries.map((entry) => (
                <button
                  key={entry.type}
                  type="button"
                  onClick={() => onAdd(makeBlock(entry.type))}
                  title={entry.description}
                  className="flex flex-col gap-1 rounded-md border border-border bg-background p-2 text-left transition hover:border-primary hover:bg-primary/5"
                >
                  <span className="flex size-6 items-center justify-center rounded bg-primary/10 text-primary">
                    <BlockIcon name={entry.icon} size={14} />
                  </span>
                  <span className="text-xs font-medium leading-tight">{entry.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
