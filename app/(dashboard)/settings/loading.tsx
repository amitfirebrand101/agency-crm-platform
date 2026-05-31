export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-24 rounded-md bg-border" />
        <div className="mt-1 h-4 w-64 rounded bg-border" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[14rem_1fr]">
        {/* Sidebar nav */}
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-full rounded-md bg-border" />
          ))}
        </div>
        {/* Content */}
        <div className="rounded-xl border border-border bg-panel p-6 shadow-soft space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-border" />
              <div className="h-9 w-full rounded-md bg-border" />
            </div>
          ))}
          <div className="h-9 w-28 rounded-md bg-border" />
        </div>
      </div>
    </div>
  );
}
