import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/^["']|["']$/g, "") ??
  "http://localhost:3000";

export default async function InboundWebhookDeliveriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const webhook = await prisma.inboundWebhook.findFirst({
    where: {
      id,
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined,
    },
    include: {
      deliveries: {
        orderBy: { receivedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!webhook) notFound();

  const endpointUrl = `${APP_URL}/api/inbound/${webhook.token}`;
  const deliveries = webhook.deliveries;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={"/webhooks/inbound" as never}
        className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition"
      >
        <ArrowLeft size={14} />
        Back to Inbound Webhooks
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Inbox size={16} />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">{webhook.name}</h1>
          <p
            className="mt-0.5 max-w-lg truncate font-mono text-xs text-muted"
            title={endpointUrl}
          >
            {endpointUrl}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-sm">
        <Badge variant={webhook.active ? "success" : "muted"}>
          {webhook.active ? "Active" : "Inactive"}
        </Badge>
        <span className="text-muted">{webhook.receiveCount} total received</span>
        {webhook.lastReceivedAt ? (
          <span className="text-muted">
            Last received {webhook.lastReceivedAt.toLocaleString()}
          </span>
        ) : (
          <span className="text-muted">Never received</span>
        )}
      </div>

      {/* Deliveries table */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">Recent Deliveries</h2>
          <span className="ml-2 rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
            Last {deliveries.length}
          </span>
        </CardHeader>

        {deliveries.length === 0 ? (
          <CardBody>
            <div className="py-10 text-center">
              <Inbox className="mx-auto mb-3 text-muted" size={32} />
              <p className="font-semibold">No deliveries yet</p>
              <p className="mt-1 text-sm text-muted">
                Send a POST request to the endpoint above to get started.
              </p>
            </div>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Received At</th>
                  <th className="px-5 py-3">IP Address</th>
                  <th className="px-5 py-3">Payload Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveries.map((delivery) => {
                  const payloadStr = JSON.stringify(delivery.payload);
                  const preview =
                    payloadStr.length > 200
                      ? payloadStr.slice(0, 200) + "…"
                      : payloadStr;

                  return (
                    <tr
                      key={delivery.id}
                      className="hover:bg-background/50 transition"
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                        {delivery.receivedAt.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted">
                        {delivery.ipAddress ?? "—"}
                      </td>
                      <td
                        className="max-w-md px-5 py-3 font-mono text-xs text-muted"
                        title={payloadStr}
                      >
                        {preview}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
