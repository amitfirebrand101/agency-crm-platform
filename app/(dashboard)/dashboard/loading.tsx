export default function DashboardPageLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-panel p-5 shadow-soft">
            <div className="h-3 w-20 rounded bg-border" />
            <div className="mt-3 h-7 w-16 rounded bg-border" />
            <div className="mt-1 h-3 w-24 rounded bg-border" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border border-border bg-panel shadow-soft">
          <div className="border-b border-border px-5 py-4">
            <div className="h-4 w-32 rounded bg-border" />
          </div>
          <div className="divide-y divide-border px-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-3">
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-36 rounded bg-border" />
                  <div className="h-3 w-48 rounded bg-border" />
                </div>
                <div className="h-5 w-16 rounded-full bg-border" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-panel shadow-soft h-48">
            <div className="border-b border-border px-5 py-4">
              <div className="h-4 w-24 rounded bg-border" />
            </div>
          </div>
          <div className="grid gap-4 grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-panel p-4 shadow-soft">
                <div className="h-3 w-20 rounded bg-border" />
                <div className="mt-3 h-7 w-10 rounded bg-border" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
