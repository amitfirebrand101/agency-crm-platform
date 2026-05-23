import Link from "next/link";
import { Bot, Play, Plus, RadioTower, Workflow } from "lucide-react";
import {
  addAction,
  addTrigger,
  createWorkflow,
  publishWorkflow,
  runTestWorkflow,
  unpublishWorkflow
} from "@/app/(dashboard)/automations/actions";
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
    console.error("Automations page render failed", error);
    return <AutomationsFallback />;
  }
}

async function AutomationsContent({ searchParams }: AutomationsPageProps) {
  const params = await searchParams;
  const selectedId = params?.workflow;
  const user = await requireUser();
  let databaseUnavailable = false;
  let automations: Awaited<ReturnType<typeof prisma.automation.findMany>> = [];
  let contacts: Awaited<ReturnType<typeof prisma.contact.findMany>> = [];

  try {
    [automations, contacts] = await Promise.all([
      prisma.automation.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { updatedAt: "desc" }
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

  const selected = automations.find((automation) => automation.id === selectedId) ?? automations[0] ?? null;
  const definition = selected ? parseAutomationDefinition(selected.definition) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Automations</h1>
        <p className="mt-1 text-sm text-muted">
          Build trigger-based workflows with sequential actions, draft/publish control, and manual test runs.
        </p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      <section className="grid gap-6 xl:grid-cols-[19rem_1fr_22rem]">
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
                  className="block rounded-md border border-border bg-background p-3 transition hover:border-primary"
                  href={`/automations?workflow=${automation.id}`}
                  key={automation.id}
                >
                  <div className="font-medium">{automation.name}</div>
                  <div className="mt-1 text-xs font-semibold uppercase text-muted">{automation.status}</div>
                </Link>
              ))}
              {!automations.length ? <div className="text-sm text-muted">No workflows yet.</div> : null}
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Workflow className="text-primary" size={18} />
                  <h2 className="font-semibold">{selected?.name ?? "Workflow builder"}</h2>
                </div>
                {selected ? (
                  <form action={selected.status === "published" ? unpublishWorkflow : publishWorkflow}>
                    <input name="automationId" type="hidden" value={selected.id} />
                    <button className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">
                      {selected.status === "published" ? "Switch to draft" : "Publish"}
                    </button>
                  </form>
                ) : null}
              </div>
            </CardHeader>
            <CardBody>
              {selected && definition ? (
                <div className="space-y-6">
                  <section>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <RadioTower className="text-primary" size={16} />
                      Triggers
                    </div>
                    <div className="space-y-2">
                      {definition.triggers.map((trigger) => (
                        <div className="rounded-md border border-border bg-background p-3" key={trigger.id}>
                          <div className="font-medium">{trigger.name}</div>
                          {Object.keys(trigger.config).length ? <div className="mt-1 text-xs text-muted">{JSON.stringify(trigger.config)}</div> : null}
                        </div>
                      ))}
                      {!definition.triggers.length ? <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">Add at least one trigger.</div> : null}
                    </div>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Play className="text-primary" size={16} />
                      Actions
                    </div>
                    <div className="space-y-2">
                      {definition.steps.map((step, index) => (
                        <div className="rounded-md border border-border bg-background p-3" key={step.id}>
                          <div className="text-xs font-semibold uppercase text-muted">Step {index + 1}</div>
                          <div className="mt-1 font-medium">{step.name}</div>
                          {Object.keys(step.config).length ? <div className="mt-1 text-xs text-muted">{JSON.stringify(step.config)}</div> : null}
                        </div>
                      ))}
                      {!definition.steps.length ? <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">Add at least one action.</div> : null}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted">Create a workflow to start building.</div>
              )}
            </CardBody>
          </Card>

          {selected ? (
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Test workflow</h2>
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
                  <button className="rounded-md border border-border px-3 py-2 text-sm font-semibold" type="submit">
                    Run test
                  </button>
                </form>
              </CardBody>
            </Card>
          ) : null}
        </div>

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
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="type">
                      {triggerCatalog.map((trigger) => (
                        <option key={trigger.type} value={trigger.type}>
                          {trigger.category}: {trigger.label}{trigger.executable ? "" : " (catalog)"}
                        </option>
                      ))}
                    </select>
                    <Field label="Filter" name="filter" placeholder="Tag name, optional" />
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
                    <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="type">
                      {actionCatalog.map((action) => (
                        <option key={action.type} value={action.type}>
                          {action.category}: {action.label}{action.executable ? "" : " (catalog)"}
                        </option>
                      ))}
                    </select>
                    <Field label="Primary setting" name="primary" placeholder="Tag, field, subject, name, duration" />
                    <Field label="Secondary setting" name="secondary" placeholder="Value, channel, amount, unit" />
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
        <p className="mt-1 text-sm text-muted">
          Build trigger-based workflows with sequential actions, draft/publish control, and manual test runs.
        </p>
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
            <div className="text-sm text-muted">Workflows will load when the database connection is available.</div>
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
            <div className="space-y-4">
              <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
                Trigger catalog and action catalog are ready. Live workflow editing needs database access.
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {triggerCatalog.slice(0, 6).map((trigger) => (
                  <div className="rounded-md border border-border bg-background p-3 text-sm" key={trigger.type}>
                    <div className="font-medium">{trigger.label}</div>
                    <div className="mt-1 text-xs text-muted">{trigger.category}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {actionCatalog.slice(0, 6).map((action) => (
                  <div className="rounded-md border border-border bg-background p-3 text-sm" key={action.type}>
                    <div className="font-medium">{action.label}</div>
                    <div className="mt-1 text-xs text-muted">{action.category}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Setup required</h2>
          </CardHeader>
          <CardBody>
            <p className="text-sm leading-6 text-muted">
              Check Vercel runtime logs for the digest and confirm `AUTH_DISABLED=true`, `DATABASE_URL`, and `DIRECT_URL` are valid.
            </p>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
