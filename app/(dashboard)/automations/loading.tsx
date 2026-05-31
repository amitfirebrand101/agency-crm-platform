export default function AutomationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-36 rounded-md bg-border" />
          <div className="mt-1 h-4 w-64 rounded bg-border" />
        </div>
        <div className="h-9 w-36 rounded-md bg-border" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="h-3 w-20 rounded bg-border" />
            <div className="mt-2 h-7 w-10 rounded bg-border" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-border shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-48 rounded bg-border" />
                  <div className="h-3 w-32 rounded bg-border" />
                </div>
              </div>
              <div className="h-5 w-16 rounded-full bg-border" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
