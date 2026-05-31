export default function ConversationsLoading() {
  return (
    <div className="flex h-[calc(100vh-8rem)] animate-pulse overflow-hidden rounded-lg border border-border bg-panel shadow-soft">
      {/* Sidebar */}
      <div className="w-80 shrink-0 border-r border-border">
        <div className="border-b border-border p-3">
          <div className="h-8 w-full rounded-md bg-border" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-border" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 rounded bg-border" />
                <div className="h-3 w-40 rounded bg-border" />
              </div>
              <div className="h-3 w-8 rounded bg-border shrink-0" />
            </div>
          ))}
        </div>
      </div>
      {/* Detail pane */}
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border px-5 py-4">
          <div className="h-5 w-40 rounded bg-border" />
        </div>
        <div className="flex-1 space-y-4 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? "" : "justify-end"}`}>
              <div className={`h-12 w-64 rounded-xl bg-border ${i % 2 === 0 ? "" : "rounded-tr-none"}`} />
            </div>
          ))}
        </div>
        <div className="border-t border-border p-4">
          <div className="h-10 w-full rounded-md bg-border" />
        </div>
      </div>
    </div>
  );
}
