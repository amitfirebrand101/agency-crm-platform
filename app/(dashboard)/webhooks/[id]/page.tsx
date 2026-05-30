import Link from "next/link";
import { ArrowLeft, CheckCircle2, Globe, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { deleteDeliveryLog, toggleWebhookEnabled } from "@/app/(dashboard)/webhooks/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WebhookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: {
      id,
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined,
    },
    include: {
      deliveryLogs: {
        orderBy: { attemptedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!endpoint) notFound();

  const logs = endpoint.deliveryLogs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-4">
        <Link
          href={"/webhooks" as never}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition"
        >
          <ArrowLeft size={14} />
          Back to Webhooks
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Globe size={16} />
            </span>
            <div>
              <h1 className="text-2xl font-semibold">{endpoint.name}</h1>
              <p
                className="mt-0.5 max-w-lg truncate text-sm text-muted"
                title={endpoint.url}
              >
                {endpoint.url}
              </p>
            </div>
          </div>
        </div>

        {/* Enable / disable toggle */}
        <form action={toggleWebhookEnabled}>
          <input type="hidden" name="id" value={endpoint.id} />
          <input
            type="hidden"
            name="enabled"
            value={endpoint.enabled ? "false" : "true"}
          />
          <SubmitButton
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:bg-background hover:text-foreground transition"
            pendingText="Saving…"
          >
            {endpoint.enabled ? "Disable Endpoint" : "Enable Endpoint"}
          </SubmitButton>
        </form>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-4 text-sm">
        <Badge variant={endpoint.enabled ? "success" : "muted"}>
          {endpoint.enabled ? "Active" : "Disabled"}
        </Badge>
        <span className="text-green-700 font-medium">{endpoint.successCount} successful</span>
        {endpoint.failureCount > 0 && (
          <span className="text-red-700 font-medium">{endpoint.failureCount} failed</span>
        )}
        {endpoint.lastTriggeredAt ? (
          <span className="text-muted">
            Last triggered {endpoint.lastTriggeredAt.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted">Never triggered</span>
        )}
      </div>

      {/* Delivery Logs */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Delivery Logs</h2>
          <span className="ml-2 rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
            Last {logs.length}
          </span>
        </CardHeader>

        {logs.length === 0 ? (
          <CardBody>
            <div className="py-10 text-center">
              <Globe className="mx-auto mb-3 text-muted" size={32} />
              <p className="font-semibold">No deliveries yet</p>
              <p className="mt-1 text-sm text-muted">
                Logs will appear here once this endpoint receives events.
              </p>
            </div>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Attempted At</th>
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">HTTP</th>
                  <th className="px-5 py-3">Duration</th>
                  <th className="px-5 py-3">Response</th>
                  <th className="px-5 py-3 sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-background/50 transition"
                  >
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                      {log.attemptedAt.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="info" className="text-[10px]">
                        {log.event}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {log.success ? (
                        <span className="flex items-center gap-1 text-green-700">
                          <CheckCircle2 size={13} />
                          <span className="text-xs font-semibold">Success</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-700">
                          <XCircle size={13} />
                          <span className="text-xs font-semibold">Failed</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {log.responseStatus ? (
                        <Badge
                          variant={
                            log.responseStatus < 300
                              ? "success"
                              : log.responseStatus < 400
                              ? "warning"
                              : "danger"
                          }
                        >
                          {log.responseStatus}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {log.durationMs != null ? `${log.durationMs}ms` : "—"}
                    </td>
                    <td className="max-w-xs px-5 py-3 font-mono text-xs text-muted">
                      {log.error ? (
                        <span className="text-red-700">{log.error.slice(0, 120)}</span>
                      ) : log.responseBody ? (
                        <span title={log.responseBody}>
                          {log.responseBody.length > 80
                            ? log.responseBody.slice(0, 80) + "…"
                            : log.responseBody}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <form action={deleteDeliveryLog}>
                        <input type="hidden" name="logId" value={log.id} />
                        <input type="hidden" name="endpointId" value={endpoint.id} />
                        <SubmitButton
                          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition"
                          pendingText="…"
                        >
                          Delete
                        </SubmitButton>
                      </form>
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
