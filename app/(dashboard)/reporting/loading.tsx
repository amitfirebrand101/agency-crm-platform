export default function ReportingLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-28 rounded-md bg-border" />
        <div className="mt-1 h-4 w-72 rounded bg-border" />
      </div>
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-panel p-5 shadow-soft">
            <div className="h-3 w-24 rounded bg-border" />
            <div className="mt-2 h-8 w-16 rounded bg-border" />
          </div>
        ))}
      </div>
      {/* Chart area */}
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-panel p-5 shadow-soft space-y-3">
            <div className="h-5 w-36 rounded bg-border" />
            <div className="h-48 w-full rounded-lg bg-border" />
          </div>
        ))}
      </div>
    </div>
  );
}
