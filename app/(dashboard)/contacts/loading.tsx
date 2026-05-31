export default function ContactsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-28 rounded-md bg-border" />
        <div className="mt-1 h-4 w-80 rounded bg-border" />
      </div>
      <div className="h-8 w-full rounded-lg bg-border" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="h-3 w-24 rounded bg-border" />
            <div className="mt-2 h-7 w-12 rounded bg-border" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-panel shadow-soft">
        <div className="border-b border-border px-5 py-3 flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 w-20 rounded bg-border" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-8 w-8 rounded-full bg-border shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-36 rounded bg-border" />
                <div className="h-3 w-48 rounded bg-border" />
              </div>
              <div className="h-5 w-16 rounded-full bg-border" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
