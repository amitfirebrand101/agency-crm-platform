import Link from "next/link";
import { Bot, CheckCircle, Clock, Play, Plus, RadioTower, Trash2, Workflow, XCircle } from "lucide-react";
import type { Prisma } from "@prisma/client";
import {
  addAction,
  addTrigger,
  createWorkflow,
  deleteWorkflow,
  publishWorkflow,
  removeStep,
  removeTrigger,
  runTestWorkflow,
  unpublishWorkflow
} from "@/app/(dashboard)/automations/actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { actionCatalog, triggerCatalog } from "@/lib/automations/catalog";
import { parseAutomationDefinition } from "@/lib/automations/types";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AutomationsPageProps = {
  searchParams?: Promise<{ workflow?: string }>;
};

export default async function AutomationsPage({ searchParams }: AutomationsPageProps) {
  try {
    return await AutomationsContent({ searchParams });
  } catch (error) {
    // Re-throw navigation errors (redirect, notFound)
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("Automations page render failed", error);
    return <AutomationsFallback />;
  }
}

type AutomationWithRuns = Prisma.AutomationGetPayload<{
  include: { runs: { orderBy: { startedAt: "desc" }; take: 5 } };
}>;

async function AutomationsContent({ searchParams }: AutomationsPageProps) {
  const params = await searchParams;
  const selectedId = params?.workflow;
  const user = await requireUser();
  let databaseUnavailable = false;
  let automations: AutomationWithRuns[] = [];
  let contacts: Awaited<ReturnType<typeof prisma.contact.findMany>> = [];

  try {
    [automations, contacts] = await Promise.all([
      prisma.automation.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { updatedAt: "desc" },
        include: { runs: { orderBy: { startedAt: "desc" }, take: 5 } }
      }),
      prisma.contact.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { createdAt: "desc" },
        take: 25
      })
    ]);
  } catch (error) {
    databaseUnavailable = true;
    console.error("Automations page database query failed", error);
  }

  const selected = automations.find((a) => a.id === selectedId) ?? automations[0] ?? null;
  const definition = selected ? parseAutomationDefinition(selected.definition) : null;

  const webhookTrigger = definition?.triggers.find((t) => t.type === "INBOUND_WEBHOOK");
  const webhookUrl = webhookTrigger?.config.token
    ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/workflows/${selected?.id}/webhook?token=${webhookTrigger.config.token}`
    : null;

  const RUN_STATUS_ICONS: Record<string, React.ReactNode> = {
    COMPLETED: <CheckCircle className="text-positive" size={14} />,
    FAILED: <XCircle className="text-red-500" size={14} />,
    RUNNING: <Clock className="text-primary animate-spin" size={14} />,
    WAITING: <Clock className="text-amber-500" size={14} />
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Automations</h1>
        <p className="mt-1 text-sm text-muted">
          Build trigger-based workflows with sequential actions, if/else branching, draft/publish control, and full run history.
        </p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      <section className="grid gap-6 xl:grid-cols-[19rem_1fr_22rem]">
        {/* Workflow list */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="text-primary" size={18} />
              <h2 className="font-semibold">Workflows</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {automations.map((automation) => (
                <Link
                  className={`block rounded-md border p-3 transition ${
                    selected?.id === automation.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-primary"
                  }`}
                  href={`/automations?workflow=${automation.id}`}
                  key={automation.id}
                >
                  <div className="font-medium text-sm">{automation.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={automation.status === "published" ? "success" : "muted"}>{automation.status}</Badge>
                    <span className="text-xs text-muted">{automation.runs.length} runs</span>
                  </div>
                </Link>
              ))}
              {!automations.length ? <p className="text-sm text-muted">No workflows yet.</p> : null}
            </div>
          </CardBody>
        </Card>

        {/* Builder + run history */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Workflow className="text-primary" size={18} />
                  <h2 className="font-semibold">{selected?.name ?? "Workflow builder"}</h2>
                </div>
                {selected ? (
                  <div className="flex items-center gap-2">
                    <form action={selected.status === "published" ? unpublishWorkflow : publishWorkflow}>
                      <input name="automationId" type="hidden" value={selected.id} />
                      <button className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">
                        {selected.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                    <form action={deleteWorkflow}>
                      <input name="automationId" type="hidden" value={selected.id} />
                      <button
                        className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition"
                        type="submit"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardBody>
              {selected && definition ? (
                <div className="space-y-6">
                  {/* Triggers */}
                  <section>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <RadioTower className="text-primary" size={16} />
                      Triggers
                    </div>
                    <div className="space-y-2">
                      {definition.triggers.map((trigger) => (
                        <div className="flex items-center justify-between rounded-md border border-border bg-background p-3" key={trigger.id}>
                          <div>
                            <div className="font-medium text-sm">{trigger.name}</div>
                            {Object.keys(trigger.config).length > 0 ? (
                              <div className="mt-1 text-xs text-muted font-mono">
                                {Object.entries(trigger.config)
                                  .filter(([k]) => k !== "token")
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(" · ")}
                              </div>
                            ) : null}
                            {trigger.type === "INBOUND_WEBHOOK" && webhookUrl ? (
                              <div className="mt-1 truncate text-xs text-muted font-mono max-w-xs">{webhookUrl}</div>
                            ) : null}
                          </div>
                          <form action={removeTrigger}>
                            <input name="automationId" type="hidden" value={selected.id} />
                            <input name="triggerId" type="hidden" value={trigger.id} />
                            <button className="rounded p-1 text-muted hover:text-red-600 transition" title="Remove trigger" type="submit">
                              <Trash2 size={14} />
                            </button>
                          </form>
                        </div>
                      ))}
                      {!definition.triggers.length ? (
                        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">Add at least one trigger.</div>
                      ) : null}
                    </div>
                  </section>

                  {/* Steps */}
                  <section>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Play className="text-primary" size={16} />
                      Actions
                    </div>
                    <div className="space-y-2">
                      {definition.steps.map((step, index) => (
                        <div className="flex items-center justify-between rounded-md border border-border bg-background p-3" key={step.id}>
                          <div>
                            <div className="text-xs font-semibold uppercase text-muted">Step {index + 1}</div>
                            <div className="mt-1 font-medium text-sm">{step.name}</div>
                            {Object.keys(step.config).length > 0 ? (
                              <div className="mt-1 text-xs text-muted font-mono">
                                {Object.entries(step.config)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(" · ")}
                              </div>
                            ) : null}
                          </div>
                          <form action={removeStep}>
                            <input name="automationId" type="hidden" value={selected.id} />
                            <input name="stepId" type="hidden" value={step.id} />
                            <button className="rounded p-1 text-muted hover:text-red-600 transition" title="Remove step" type="submit">
                              <Trash2 size={14} />
                            </button>
                          </form>
                        </div>
                      ))}
                      {!definition.steps.length ? (
                        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">Add at least one action.</div>
                      ) : null}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted">
                  Create or select a workflow to start building.
                </div>
              )}
            </CardBody>
          </Card>

          {/* Test run */}
          {selected ? (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Test run</h2>
              </CardHeader>
              <CardBody>
                <form action={runTestWorkflow} className="flex flex-col gap-3 md:flex-row">
                  <input name="automationId" type="hidden" value={selected.id} />
                  <select className="min-h-10 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" name="contactId">
                    <option value="">No contact context</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.firstName} {contact.lastName ?? ""} {contact.email ? `(${contact.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-md border border-border px-4 py-2 text-sm font-semibold" type="submit">
                    Run test
                  </button>
                </form>
              </CardBody>
            </Card>
          ) : null}

          {/* Run history */}
          {selected && selected.runs.length > 0 ? (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Recent runs</h2>
              </CardHeader>
              <CardBody>
                <div className="divide-y divide-border">
                  {selected.runs.map((run) => (
                    <div className="flex items-center justify-between gap-4 py-3" key={run.id}>
                      <div className="flex items-center gap-2">
                        {RUN_STATUS_ICONS[run.status] ?? <Clock size={14} />}
                        <div>
                          <div className="text-sm font-medium">{run.triggerType}</div>
                          <div className="text-xs text-muted">{new Date(run.startedAt).toLocaleString()}</div>
                        </div>
                      </div>
                      <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">New workflow</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createWorkflow} className="space-y-3">
                <Field label="Name" name="name" placeholder="New lead nurture" required />
                <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">
                  Create workflow
                </button>
              </form>
            </CardBody>
          </Card>

          {selected ? (
            <>
              <Card>
                <CardHeader>
                  <h2 className="font-semibold">Add trigger</h2>
                </CardHeader>
                <CardBody>
                  <form action={addTrigger} className="space-y-3">
                    <input name="automationId" type="hidden" value={selected.id} />
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Trigger type</span>
                      <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="type">
                        {triggerCatalog.map((trigger) => (
                          <option key={trigger.type} value={trigger.type}>
                            {trigger.label}{!trigger.executable ? " (coming soon)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field label="Filter / value (optional)" name="filter" placeholder="Tag name, status…" />
                    <button className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold" type="submit">
                      Add trigger
                    </button>
                  </form>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="font-semibold">Add action</h2>
                </CardHeader>
                <CardBody>
                  <form action={addAction} className="space-y-3">
                    <input name="automationId" type="hidden" value={selected.id} />
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Action type</span>
                      <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="type">
                        {actionCatalog.map((action) => (
                          <option key={action.type} value={action.type}>
                            {action.label}{!action.executable ? " (coming soon)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field label="Primary setting" name="primary" placeholder="Tag name, field, URL, duration…" />
                    <Field label="Secondary setting" name="secondary" placeholder="Value, channel, unit…" />
                    <button className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold" type="submit">
                      Add action
                    </button>
                  </form>
                </CardBody>
              </Card>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AutomationsFallback() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Automations</h1>
        <p className="mt-1 text-sm text-muted">Build trigger-based workflows with sequential actions, branching, and full run history.</p>
      </div>
      <DbWarning />
      <section className="grid gap-6 xl:grid-cols-[19rem_1fr_22rem]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="text-primary" size={18} />
              <h2 className="font-semibold">Workflows</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-sm text-muted">Workflows will appear when the database connection is available.</div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Workflow className="text-primary" size={18} />
              <h2 className="font-semibold">Workflow builder</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 md:grid-cols-2">
              {triggerCatalog.slice(0, 4).map((trigger) => (
                <div className="rounded-md border border-border bg-background p-3 text-sm" key={trigger.type}>
                  <div className="font-medium">{trigger.label}</div>
                  <div className="mt-1 text-xs text-muted">{trigger.category}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Setup required</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm leading-6 text-muted">
              Confirm <code className="rounded bg-background px-1 py-0.5 text-xs">AUTH_DISABLED=true</code>, <code className="rounded bg-background px-1 py-0.5 text-xs">DATABASE_URL</code>, and <code className="rounded bg-background px-1 py-0.5 text-xs">DIRECT_URL</code> are set in Vercel.
            </p>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
