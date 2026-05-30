import Link from "next/link";
import { ArrowLeft, Key } from "lucide-react";
import { notFound } from "next/navigation";
import { revokeApiKey } from "@/app/(dashboard)/api-keys/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function statusCodeVariant(
  code: number | null
): "success" | "warning" | "danger" | "muted" {
  if (code == null) return "muted";
  if (code < 300) return "success";
  if (code < 400) return "warning";
  return "danger";
}

function keyStatus(key: { revokedAt: Date | null; expiresAt: Date | null }): {
  label: string;
  variant: "success" | "danger" | "warning";
} {
  if (key.revokedAt) return { label: "Revoked", variant: "danger" };
  if (key.expiresAt && key.expiresAt < new Date())
    return { label: "Expired", variant: "warning" };
  return { label: "Active", variant: "success" };
}

export default async function ApiKeyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const apiKey = await prisma.apiKey.findFirst({
    where: { id, agencyId: user.agencyId },
    include: {
      usageLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!apiKey) notFound();

  const status = keyStatus(apiKey);
  const logs = apiKey.usageLogs;

  const SCOPE_VARIANTS: Record<string, "info" | "warning" | "danger"> = {
    read: "info",
    write: "warning",
    admin: "danger",
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={"/api-keys" as never}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition"
      >
        <ArrowLeft size={14} />
        Back to API Keys
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Key size={16} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{apiKey.name}</h1>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="rounded bg-background px-2 py-0.5 font-mono text-xs text-muted">
                {apiKey.keyPrefix}...
              </code>
              {apiKey.scopes.map((scope) => (
                <Badge key={scope} variant={SCOPE_VARIANTS[scope] ?? "muted"}>
                  {scope}
                </Badge>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
              <span>
                Rate limit: {apiKey.rateLimitPerHour.toLocaleString()} req/hr
              </span>
              <span>Created {apiKey.createdAt.toLocaleDateString()}</span>
              {apiKey.lastUsedAt ? (
                <span>Last used {apiKey.lastUsedAt.toLocaleString()}</span>
              ) : (
                <span>Never used</span>
              )}
              {apiKey.expiresAt ? (
                <span>Expires {apiKey.expiresAt.toLocaleDateString()}</span>
              ) : null}
              {apiKey.revokedAt ? (
                <span className="text-red-700">
                  Revoked {apiKey.revokedAt.toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {!apiKey.revokedAt ? (
          <form action={revokeApiKey}>
            <input type="hidden" name="id" value={apiKey.id} />
            <SubmitButton
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
              pendingText="Revoking…"
            >
              Revoke Key
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {/* Usage logs */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Usage Logs</h2>
          <span className="ml-2 rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
            Last {logs.length}
          </span>
        </CardHeader>

        {logs.length === 0 ? (
          <CardBody>
            <div className="py-10 text-center">
              <Key className="mx-auto mb-3 text-muted" size={32} />
              <p className="font-semibold">No usage yet</p>
              <p className="mt-1 text-sm text-muted">
                Requests made with this key will appear here.
              </p>
            </div>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Path</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">IP</th>
                  <th className="px-5 py-3">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-background/50 transition"
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                      {log.createdAt.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded bg-background px-1.5 py-0.5 font-mono text-xs font-semibold">
                        {log.method}
                      </span>
                    </td>
                    <td
                      className="max-w-xs truncate px-5 py-3 font-mono text-xs text-muted"
                      title={log.path}
                    >
                      {log.path}
                    </td>
                    <td className="px-5 py-3">
                      {log.statusCode != null ? (
                        <Badge variant={statusCodeVariant(log.statusCode)}>
                          {log.statusCode}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted">
                      {log.ipAddress ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {log.durationMs != null ? `${log.durationMs}ms` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
