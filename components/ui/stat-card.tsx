type StatCardProps = {
  label: string;
  value: string;
  helper: string;
  icon?: React.ReactNode;
};

export function StatCard({ label, value, helper, icon }: StatCardProps) {
  return (
    <article className="rounded-lg border border-border bg-panel p-5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon ? (
          <span className="text-muted">{icon}</span>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      <p className="mt-1 text-xs text-muted">{helper}</p>
    </article>
  );
}
