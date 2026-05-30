import Link from "next/link";
import { ExternalLink, Inbox, Trash2 } from "lucide-react";
import {
  createInboundWebhook,
  deleteInboundWebhook,
} from "@/app/(dashboard)/webhooks/inbound/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/^["']|["']$/g, "") ??
  "http://localhost:3000";

export default async function InboundWebhooksPage() {
  const user = await requireUser();
  let webhooks: Awaited<
    ReturnType<typeof prisma.inboundWebhook.findMany>
  > = [];
  let databaseUnavailable = false;

  try {
    webhooks = await prisma.inboundWebhook.findMany({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    databaseUnavailable = true;
    console.error("Inbound webhooks page query failed", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inbound Webhooks</h1>
        <p className="mt-1 text-sm text-muted">
          Receive data from third-party services like Zapier, Make, or custom
          integrations.
        </p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Inbound webhook list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Inbox className="text-primary" size={17} />
              <h2 className="font-semibold">Inbound Endpoints</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {webhooks.length}
              </span>
            </div>
          </CardHeader>

          {webhooks.length === 0 && !databaseUnavailable ? (
            <CardBody>
              <div className="py-10 text-center">
                <Inbox className="mx-auto mb-3 text-muted" size={32} />
                <p className="font-semibold">No inbound webhooks yet</p>
                <p className="mt-1 text-sm text-muted">
                  Create your first endpoint using the form on the right.
                </p>
              </div>
            </CardBody>
          ) : (
            <div className="divide-y divide-border">
              {webhooks.map((wh) => {
                const endpointUrl = `${APP_URL}/api/inbound/${wh.token}`;
                return (
                  <div
                    key={wh.id}
                    className="flex items-start gap-4 px-5 py-4 hover:bg-background/50 transition"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Inbox size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{wh.name}</span>
                        <Badge variant={wh.active ? "success" : "muted"}>
                          {wh.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {wh.description ? (
                        <p className="mt-0.5 text-xs text-muted">
                          {wh.description}
                        </p>
                      ) : null}
                      <p
                        className="mt-0.5 truncate font-mono text-xs text-muted"
                        title={endpointUrl}
                      >
                        {endpointUrl}
                      </p>
                      <div className="mt-1.5 flex gap-3 text-xs text-muted">
                        <span>{wh.receiveCount} received</span>
                        {wh.lastReceivedAt ? (
                          <span>
                            Last {wh.lastReceivedAt.toLocaleDateString()}
                          </span>
                        ) : (
                          <span>Never received</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/webhooks/inbound/${wh.id}` as never}
                        className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-background hover:text-foreground transition"
                      >
                        <ExternalLink size={11} />
                        Deliveries
                      </Link>
                      <form action={deleteInboundWebhook}>
                        <input type="hidden" name="id" value={wh.id} />
                        <SubmitButton
                          className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                          pendingText="…"
                        >
                          <Trash2 size={11} />
                          Delete
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Create form */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Create Inbound Webhook</h2>
          </CardHeader>
          <CardBody>
            <form action={createInboundWebhook} className="space-y-4">
              <Field
                label="Name"
                name="name"
                placeholder="Zapier Integration"
                required
              />
              <Field
                label="Description (optional)"
                name="description"
                placeholder="What sends data to this endpoint?"
              />
              <SubmitButton
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Creating…"
              >
                Create Endpoint
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
