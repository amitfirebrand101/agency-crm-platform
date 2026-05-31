const isDev = process.env.NODE_ENV === "development";

/**
 * Times an async operation and logs its duration in development.
 * No-op in production — zero overhead.
 */
export async function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isDev) return fn();
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = (performance.now() - start).toFixed(1);
    console.log(`[perf] ${label}: ${ms}ms`);
  }
}
