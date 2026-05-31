import { Mail, MessageSquare, Plus, Radio, Send, Trash2 } from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emailConfigured } from "@/lib/email";
import { twilioConfigured } from "@/lib/twilio";
import { createBroadcast, deleteBroadcast, sendBroadcast } from "./actions";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let broadcasts: Awaited<ReturnType<typeof prisma.broadcast.findMany>> = [];

  try {
    broadcasts = await prisma.broadcast.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Broadcasts page database query failed", error);
  }

  const draftCount = broadcasts.filter((b) => b.status === "draft").length;
  const scheduledCount = broadcasts.filter((b) => b.status === "scheduled").length;
  const sentCount = broadcasts.filter((b) => b.status === "sent").length;
  const hasEmail = emailConfigured();
  const hasSms = twilioConfigured();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Broadcasts</h1>
        <p className="mt-1 text-sm text-muted">
          Send one-time messages to a segment of your contacts via email or SMS.
        </p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      {broadcasts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="text-sm text-muted">Draft</div>
            <div className="mt-1 text-2xl font-semibold">{draftCount}</div>
          </article>
          <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="text-sm text-muted">Scheduled</div>
            <div className="mt-1 text-2xl font-semibold">{scheduledCount}</div>
          </article>
          <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
            <div className="text-sm text-muted">Sent</div>
            <div className="mt-1 text-2xl font-semibold">{sentCount}</div>
          </article>
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Radio className="text-primary" size={18} />
              <h2 className="font-semibold">Broadcasts</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {broadcasts.length}
              </span>
            </div>
          </CardHeader>
          <CardBody>
            {broadcasts.length > 0 ? (
              <div className="divide-y divide-border">
                {broadcasts.map((broadcast) => {
                  const canSend =
                    broadcast.status === "draft" &&
                    ((broadcast.channel === "SMS" && hasSms) ||
                      (broadcast.channel === "Email" && hasEmail));

                  return (
                    <div className="flex items-center justify-between gap-4 py-3" key={broadcast.id}>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{broadcast.name}</div>
                        <div className="flex items-center gap-2 text-sm text-muted">
                          {broadcast.channel === "Email" ? (
                            <Mail size={12} />
                          ) : (
                            <MessageSquare size={12} />
                          )}
                          <span>{broadcast.channel}</span>
                          <span>·</span>
                          <Send size={12} />
                          <span>{broadcast.sentCount} / {broadcast.recipientCount} sent</span>
                          <span>·</span>
                          <span>{new Date(broadcast.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusVariant(broadcast.status)}>{broadcast.status}</Badge>
                        {canSend ? (
                          <form action={sendBroadcast}>
                            <input type="hidden" name="id" value={broadcast.id} />
                            <SubmitButton
                              className="flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                              pendingText="Sending…"
                              title="Send to all eligible contacts now"
                            >
                              <Send size={11} />
                              Send Now
                            </SubmitButton>
                          </form>
                        ) : broadcast.status === "draft" ? (
                          <span className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted">
                            Provider not connected
                          </span>
                        ) : null}
                        <form action={deleteBroadcast}>
                          <input type="hidden" name="id" value={broadcast.id} />
                          <SubmitButton
                            className="rounded p-1 text-muted hover:bg-background hover:text-danger"
                            pendingText="…"
                            title="Delete broadcast"
                          >
                            <Trash2 size={14} />
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Radio className="mx-auto mb-4 text-muted" size={32} />
                <p className="font-medium">No broadcasts yet</p>
                <p className="mt-1 text-sm text-muted">
                  Create your first broadcast to start messaging your audience.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">New Broadcast</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createBroadcast} className="space-y-3">
                <Field label="Name" name="name" placeholder="Summer sale announcement" required />

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Channel
                  </span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    name="channel"
                  >
                    <option value="SMS">SMS</option>
                    <option value="Email">Email</option>
                  </select>
                </label>

                <Field
                  label="Subject"
                  name="subject"
                  placeholder="Your special offer inside…"
                />

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Body
                  </span>
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    name="body"
                    placeholder="Write your message here…"
                    required
                    rows={5}
                  />
                </label>

                <SubmitButton
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
                  pendingText="Creating…"
                >
                  Create broadcast
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Provider status
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Email (SMTP)</span>
                  <Badge variant={hasEmail ? "success" : "warning"}>
                    {hasEmail ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>SMS (Twilio)</span>
                  <Badge variant={hasSms ? "success" : "warning"}>
                    {hasSms ? "Connected" : "Not connected"}
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">
                Connect providers in Settings → Integrations to enable sending.
              </p>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
