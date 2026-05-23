type StatCardProps = {
  label: string;
  value: string;
  helper: string;
};

export function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <article className="rounded-lg border border-border bg-panel p-5 shadow-soft">
      <p className="text-sm font-medium text-muted">{label}</p>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
      <p className="mt-2 text-sm text-muted">{helper}</p>
    </article>
  );
}
