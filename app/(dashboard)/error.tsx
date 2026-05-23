"use client";

import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <section className="w-full max-w-xl rounded-lg border border-border bg-panel p-6 shadow-soft">
        <div className="mb-4 flex size-11 items-center justify-center rounded-md bg-amber-50 text-amber-700">
          <AlertTriangle size={22} />
        </div>
        <h1 className="text-xl font-semibold">This module hit a server error</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          The app shell is still running. This usually means the deployment cannot reach the database yet, or an environment variable is malformed.
        </p>
        {error.digest ? <p className="mt-3 text-xs font-semibold text-muted">Digest: {error.digest}</p> : null}
        <button className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white" onClick={reset} type="button">
          Retry
        </button>
      </section>
    </div>
  );
}
