// Structured JSON logger.
// In production: outputs newline-delimited JSON to stdout — parseable by Vercel log drain,
// Datadog, Logflare, etc.
// In development: outputs human-readable coloured lines.

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  agencyId?: string;
  subAccountId?: string;
  userId?: string;
  action?: string;
  resource?: string;
  entityId?: string;
  durationMs?: number;
  statusCode?: number;
  method?: string;
  path?: string;
  ip?: string;
  [key: string]: unknown;
};

const IS_PROD = process.env.NODE_ENV === "production";

// ANSI colours for dev output
const COLOURS: Record<LogLevel, string> = {
  debug: "\x1b[90m", // grey
  info:  "\x1b[36m", // cyan
  warn:  "\x1b[33m", // yellow
  error: "\x1b[31m", // red
};
const RESET = "\x1b[0m";

function write(level: LogLevel, message: string, context?: LogContext): void {
  const ts = new Date().toISOString();

  if (IS_PROD) {
    // Machine-readable JSON — one object per line
    const entry: Record<string, unknown> = { ts, level, message, ...context };
    process.stdout.write(JSON.stringify(entry) + "\n");
  } else {
    // Human-readable dev output
    const colour = COLOURS[level];
    const prefix = `${colour}[${level.toUpperCase()}]${RESET}`;
    const ctx = context && Object.keys(context).length > 0
      ? " " + JSON.stringify(context)
      : "";
    // eslint-disable-next-line no-console
    console.log(`${ts} ${prefix} ${message}${ctx}`);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.LOG_LEVEL === "debug") write("debug", message, context);
  },
  info:  (message: string, context?: LogContext) => write("info",  message, context),
  warn:  (message: string, context?: LogContext) => write("warn",  message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};

// ─────────────────────────────────────────────────────────────────────────────
// Request-scoped timing helper
// ─────────────────────────────────────────────────────────────────────────────

/** Start a timer. Returns a function that logs the duration when called. */
export function startTimer(
  message: string,
  context?: LogContext
): (extraContext?: LogContext) => void {
  const start = Date.now();
  return (extraContext?: LogContext) => {
    logger.info(message, {
      ...context,
      ...extraContext,
      durationMs: Date.now() - start,
    });
  };
}
