export function DbWarning() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      Database connection is not ready in this deployment. The app shell is available, but live CRM records will appear after Vercel can reach Supabase.
    </div>
  );
}
