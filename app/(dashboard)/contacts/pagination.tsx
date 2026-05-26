import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  basePath: string;
  /** All current searchParams except `page` — will be preserved in links. */
  params: Record<string, string>;
}

/**
 * Pure server-component pagination — no client JS.
 * Renders Prev / Next links that preserve all current filter params.
 */
export function Pagination({ page, totalPages, basePath, params }: PaginationProps) {
  if (totalPages <= 1) return null;

  function buildHref(targetPage: number): string {
    const sp = new URLSearchParams();
    // Preserve every existing param except `page`
    for (const [k, v] of Object.entries(params)) {
      if (k !== "page" && v) sp.set(k, v);
    }
    if (targetPage > 1) sp.set("page", String(targetPage));
    const qs = sp.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between px-4 py-3"
    >
      {hasPrev ? (
        <a
          href={buildHref(page - 1)}
          aria-label="Go to previous page"
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-panel"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Previous
        </a>
      ) : (
        <span className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted opacity-40 cursor-not-allowed select-none">
          <ChevronLeft size={14} aria-hidden="true" />
          Previous
        </span>
      )}

      <span className="text-xs text-muted">
        Page {page} of {totalPages}
      </span>

      {hasNext ? (
        <a
          href={buildHref(page + 1)}
          aria-label="Go to next page"
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-panel"
        >
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </a>
      ) : (
        <span className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted opacity-40 cursor-not-allowed select-none">
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
