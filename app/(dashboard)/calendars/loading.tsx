export default function CalendarsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-28 rounded-md bg-border" />
          <div className="mt-1 h-4 w-64 rounded bg-border" />
        </div>
        <div className="h-9 w-32 rounded-md bg-border" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-panel p-5 shadow-soft space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 rounded bg-border" />
              <div className="h-6 w-16 rounded-full bg-border" />
            </div>
            <div className="h-3 w-48 rounded bg-border" />
            <div className="h-3 w-24 rounded bg-border" />
            <div className="flex gap-2 pt-1">
              <div className="h-7 w-16 rounded-md bg-border" />
              <div className="h-7 w-16 rounded-md bg-border" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
