export default function TasksLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-20 rounded-md bg-border" />
        <div className="mt-1 h-4 w-64 rounded bg-border" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-md bg-border" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="rounded-lg border border-border bg-panel shadow-soft">
          <div className="border-b border-border px-5 py-4">
            <div className="h-4 w-24 rounded bg-border" />
          </div>
          <div className="divide-y divide-border px-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-4">
                <div className="h-4 w-4 rounded bg-border shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-48 rounded bg-border" />
                  <div className="h-3 w-32 rounded bg-border" />
                </div>
                <div className="h-5 w-16 rounded-full bg-border" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-panel p-5 shadow-soft space-y-3">
          <div className="h-4 w-32 rounded bg-border" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-full rounded-md bg-border" />
          ))}
        </div>
      </div>
    </div>
  );
}
