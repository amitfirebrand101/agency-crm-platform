export default function SitesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-36 rounded-md bg-border" />
          <div className="mt-1 h-4 w-72 rounded bg-border" />
        </div>
        <div className="h-9 w-28 rounded-md bg-border" />
      </div>
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-t-md bg-border" />
        ))}
      </div>
      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-panel shadow-soft overflow-hidden">
            <div className="h-32 bg-border" />
            <div className="p-4 space-y-2">
              <div className="h-5 w-36 rounded bg-border" />
              <div className="h-3 w-48 rounded bg-border" />
              <div className="flex gap-2 pt-1">
                <div className="h-7 w-16 rounded-md bg-border" />
                <div className="h-7 w-16 rounded-md bg-border" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
