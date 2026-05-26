"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { GitMerge, Loader2, Search, X } from "lucide-react";
import { searchContacts, mergeContacts } from "@/app/(dashboard)/contacts/merge-actions";

type ContactMatch = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
};

type Props = {
  primaryId: string;
  primaryName: string;
};

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function MergeDialog({ primaryId, primaryName }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ContactMatch | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(
    debounce(async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const { contacts, error } = await searchContacts(q);
      setSearching(false);
      if (error) {
        setSearchError(error);
      } else {
        setSearchError(null);
        setResults(contacts.filter((c) => c.id !== primaryId));
      }
    }, 300),
    [primaryId]
  );

  useEffect(() => {
    if (query.trim().length >= 2) {
      doSearch(query);
    } else {
      setResults([]);
    }
  }, [query, doSearch]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelected(null);
      setMergeError(null);
      setSearchError(null);
    }
  }, [open]);

  function handleConfirm() {
    if (!selected) return;
    setMergeError(null);
    startTransition(async () => {
      const result = await mergeContacts(primaryId, selected.id);
      if (result?.error) {
        setMergeError(result.error);
      }
      // On success, mergeContacts redirects — no client-side handling needed
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-background"
        type="button"
      >
        <GitMerge size={15} />
        Merge contact
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-panel shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <GitMerge size={18} className="text-primary" />
                <h2 className="font-semibold">Merge contact</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 hover:bg-background transition"
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Primary contact info */}
              <p className="text-sm text-muted">
                Keeping <span className="font-semibold text-foreground">{primaryName}</span> as the primary record. All data from the secondary contact will be merged in and the secondary will be deleted.
              </p>

              {/* Search for secondary */}
              {!selected ? (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
                    Search for contact to merge in
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
                    <input
                      ref={inputRef}
                      className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none ring-primary/20 focus:ring-4"
                      placeholder="Search by name, email, phone…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {searching && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-muted" size={14} />
                    )}
                  </div>

                  {searchError && (
                    <p className="text-xs text-red-600">{searchError}</p>
                  )}

                  {results.length > 0 && (
                    <ul className="max-h-48 overflow-y-auto rounded-md border border-border divide-y divide-border">
                      {results.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setSelected(c)}
                            className="flex w-full flex-col px-3 py-2.5 text-left text-sm hover:bg-background transition"
                          >
                            <span className="font-medium">
                              {c.firstName} {c.lastName ?? ""}
                            </span>
                            {(c.email || c.phone || c.companyName) && (
                              <span className="text-xs text-muted">
                                {[c.email, c.phone, c.companyName].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {query.trim().length >= 2 && !searching && results.length === 0 && !searchError && (
                    <p className="text-xs text-muted">No contacts found.</p>
                  )}
                </div>
              ) : (
                /* Confirmation side-by-side */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">Primary (keep)</p>
                      <p className="font-semibold text-sm">{primaryName}</p>
                    </div>
                    <div className="rounded-md border border-red-200 bg-red-50 p-3">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-600">Secondary (delete)</p>
                      <p className="font-semibold text-sm">
                        {selected.firstName} {selected.lastName ?? ""}
                      </p>
                      {selected.email && <p className="text-xs text-muted">{selected.email}</p>}
                      {selected.phone && <p className="text-xs text-muted">{selected.phone}</p>}
                    </div>
                  </div>

                  <p className="text-xs text-muted rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    All conversations, tasks, appointments, opportunities, and tags from the secondary contact will be moved to the primary. Empty fields on the primary will be filled from the secondary. This action cannot be undone.
                  </p>

                  {mergeError && (
                    <p className="text-xs text-red-600 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                      {mergeError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-xs text-muted hover:text-foreground underline"
                  >
                    Choose a different contact
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-background"
              >
                Cancel
              </button>
              {selected && (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <GitMerge size={14} />}
                  Confirm merge
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
