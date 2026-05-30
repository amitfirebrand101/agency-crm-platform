import { Globe, Trash2 } from "lucide-react";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  toggleWebhookEndpoint,
} from "@/app/(dashboard)/webhooks/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const WEBHOOK_EVENTS = [
  { value: "contact.created", label: "Contact Created" },
  { value: "contact.updated", label: "Contact Updated" },
  { value: "conversation.message", label: "Conversation Message" },
  { value: "appointment.created", label: "Appointment Created" },
  { value: "opportunity.created", label: "Opportunity Created" },
  { value: "opportunity.status_changed", label: "Opportunity Status Changed" },
  { value: "form.submitted", label: "Form Submitted" },
] as const;

export default async function WebhooksPage() {
  const user = await requireUser();
  let endpoints: Awaited<ReturnType<typeof prisma.webhookEndpoint.findMany>> = [];
  let databaseUnavailable = false;

  try {
    endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        agencyId: user.agencyId,
        subAccountId: user.subAccountId ?? undefined,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (err) {
    databaseUnavailable = true;
    console.error("Webhooks page query failed", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Webhook Endpoints</h1>
        <p className="mt-1 text-sm text-muted">
          Receive real-time notifications for CRM events.
        </p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Endpoint list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="text-primary" size={17} />
              <h2 className="font-semibold">Endpoints</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {endpoints.length}
              </span>
            </div>
          </CardHeader>

          {endpoints.length === 0 && !databaseUnavailable ? (
            <CardBody>
              <div className="py-10 text-center">
                <Globe className="mx-auto mb-3 text-muted" size={32} />
                <p className="font-semibold">No webhook endpoints yet</p>
                <p className="mt-1 text-sm text-muted">
                  Add your first endpoint using the form on the right.
                </p>
              </div>
            </CardBody>
          ) : (
            <div className="divide-y divide-border">
              {endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-start gap-4 px-5 py-4 hover:bg-background/50 transition"
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Globe size={15} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{ep.name}</span>
                      <Badge variant={ep.enabled ? "success" : "muted"}>
                        {ep.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted" title={ep.url}>
                      {ep.url.length > 50 ? ep.url.slice(0, 50) + "…" : ep.url}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {ep.events.map((evt) => (
                        <Badge key={evt} variant="info" className="text-[10px]">
                          {evt}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-1.5 flex gap-3 text-xs text-muted">
                      <span className="text-green-700">{ep.successCount} ok</span>
                      {ep.failureCount > 0 && (
                        <span className="text-red-700">{ep.failureCount} failed</span>
                      )}
                      {ep.lastTriggeredAt ? (
                        <span>Last {ep.lastTriggeredAt.toLocaleDateString()}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={toggleWebhookEndpoint}>
                      <input type="hidden" name="id" value={ep.id} />
                      <input
                        type="hidden"
                        name="enabled"
                        value={ep.enabled ? "false" : "true"}
                      />
                      <SubmitButton
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-background hover:text-foreground transition"
                        pendingText="…"
                      >
                        {ep.enabled ? "Disable" : "Enable"}
                      </SubmitButton>
                    </form>
                    <form action={deleteWebhookEndpoint}>
                      <input type="hidden" name="id" value={ep.id} />
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
              ))}
            </div>
          )}
        </Card>

        {/* Add endpoint form */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Add Endpoint</h2>
          </CardHeader>
          <CardBody>
            <form action={createWebhookEndpoint} className="space-y-4">
              <Field label="Name" name="name" placeholder="My Webhook" required />
              <Field
                label="URL (HTTPS)"
                name="url"
                type="url"
                placeholder="https://example.com/webhook"
                required
              />

              <fieldset className="space-y-2">
                <legend className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Events
                </legend>
                {WEBHOOK_EVENTS.map((evt) => (
                  <label key={evt.value} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="events"
                      value={evt.value}
                      className="rounded border-border text-primary"
                    />
                    {evt.label}
                  </label>
                ))}
              </fieldset>

              <SubmitButton
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Creating…"
              >
                Add Endpoint
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
