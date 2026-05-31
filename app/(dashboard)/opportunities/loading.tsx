export default function OpportunitiesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-32 rounded-md bg-border" />
        <div className="mt-1 h-4 w-72 rounded bg-border" />
      </div>
      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shrink-0 w-72 rounded-xl border border-border bg-panel shadow-soft">
            <div className="border-b border-border px-4 py-3 flex items-center justify-between">
              <div className="h-4 w-24 rounded bg-border" />
              <div className="h-5 w-12 rounded-full bg-border" />
            </div>
            <div className="p-3 space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded-lg border border-border bg-background p-3 space-y-2">
                  <div className="h-4 w-36 rounded bg-border" />
                  <div className="h-3 w-24 rounded bg-border" />
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-5 w-5 rounded-full bg-border" />
                    <div className="h-3 w-20 rounded bg-border" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
