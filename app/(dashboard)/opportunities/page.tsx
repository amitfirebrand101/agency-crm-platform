import Link from "next/link";
import { Plus, Settings, Target, TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createOpportunity, createPipeline } from "@/app/(dashboard)/module-actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KanbanBoard } from "./kanban";

type PipelineWithStages = Prisma.PipelineGetPayload<{ include: { stages: { orderBy: { position: "asc" } } } }>;
type OpportunityWithRelations = Prisma.OpportunityGetPayload<{ include: { stage: true; contact: { select: { id: true; firstName: true; lastName: true } } } }>;

function formatCents(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ pipeline?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const activePipelineId = params?.pipeline ?? null;

  let databaseUnavailable = false;
  let pipelines: PipelineWithStages[] = [];
  let opportunities: OpportunityWithRelations[] = [];

  try {
    [pipelines, opportunities] = await Promise.all([
      prisma.pipeline.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { createdAt: "asc" },
        include: { stages: { orderBy: { position: "asc" } } },
      }),
      prisma.opportunity.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { createdAt: "desc" },
        include: { stage: true, contact: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);
  } catch (error) {
    databaseUnavailable = true;
    console.error("Opportunities page database query failed", error);
  }

  const allStages = pipelines.flatMap((p) => p.stages.map((s) => ({ ...s, pipelineName: p.name })));

  const openOpps = opportunities.filter((o) => o.status === "OPEN");
  const wonOpps = opportunities.filter((o) => o.status === "WON");
  const lostOpps = opportunities.filter((o) => o.status === "LOST");

  const openValue = openOpps.reduce((s, o) => s + o.valueCents, 0);
  const wonValue = wonOpps.reduce((s, o) => s + o.valueCents, 0);
  const lostValue = lostOpps.reduce((s, o) => s + o.valueCents, 0);

  const closedCount = wonOpps.length + lostOpps.length;
  const conversionRate = closedCount > 0 ? Math.round((wonOpps.length / closedCount) * 100) : 0;

  // Determine which pipeline to show in the kanban
  const activePipeline =
    pipelines.find((p) => p.id === activePipelineId) ?? pipelines[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Opportunities</h1>
          <p className="mt-1 text-sm text-muted">
            Pipelines, stages, and deal tracking for your agency sales workflows.
          </p>
        </div>
        <Link
          href="/opportunities/stages"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted transition hover:text-foreground"
        >
          <Settings size={14} />
          Manage stages
        </Link>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Open deals */}
        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Open Deals</p>
              <p className="mt-1.5 text-3xl font-bold">{openOpps.length}</p>
              <p className="mt-1 text-sm text-muted">{formatCents(openValue)} pipeline value</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <DollarSign className="text-blue-600" size={20} />
            </div>
          </div>
        </article>

        {/* Won */}
        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Won</p>
              <p className="mt-1.5 text-3xl font-bold text-green-600">{wonOpps.length}</p>
              <p className="mt-1 text-sm text-muted">{formatCents(wonValue)} closed won</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
              <TrendingUp className="text-green-600" size={20} />
            </div>
          </div>
        </article>

        {/* Lost */}
        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Lost</p>
              <p className="mt-1.5 text-3xl font-bold text-red-500">{lostOpps.length}</p>
              <p className="mt-1 text-sm text-muted">{formatCents(lostValue)} closed lost</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
              <TrendingDown className="text-red-500" size={20} />
            </div>
          </div>
        </article>

        {/* Conversion rate */}
        <article className="rounded-xl border border-border bg-panel p-5 shadow-soft">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Conversion Rate</p>
              <p className="mt-1.5 text-3xl font-bold">{conversionRate}%</p>
              <p className="mt-1 text-sm text-muted">
                {wonOpps.length} won / {closedCount} closed
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50">
              <Percent className="text-purple-600" size={20} />
            </div>
          </div>
        </article>
      </div>

      {/* Empty state — no pipelines */}
      {pipelines.length === 0 && !databaseUnavailable ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-panel py-20 text-center">
          <Target className="mb-4 text-muted" size={40} />
          <h2 className="text-lg font-semibold">No pipelines yet</h2>
          <p className="mt-1 text-sm text-muted">
            Create your first pipeline below to start tracking deals.
          </p>
          <a
            href="#new-pipeline"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
          >
            <Plus size={16} />
            Create your first pipeline
          </a>
        </div>
      ) : null}

      {/* Pipeline tab bar (if multiple pipelines) */}
      {pipelines.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-panel p-1.5 shadow-soft">
          {pipelines.map((pipeline) => {
            const isActive = activePipeline?.id === pipeline.id;
            return (
              <a
                key={pipeline.id}
                href={`?pipeline=${pipeline.id}`}
                className={[
                  "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:bg-background hover:text-foreground",
                ].join(" ")}
              >
                {pipeline.name}
              </a>
            );
          })}
        </div>
      ) : null}

      {/* Kanban board */}
      {activePipeline ? (
        <section>
          {pipelines.length === 1 ? (
            <div className="mb-4 flex items-center gap-2">
              <Target className="text-primary" size={18} />
              <h2 className="font-semibold">{activePipeline.name}</h2>
            </div>
          ) : null}

          {activePipeline.stages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-panel p-10 text-center text-sm text-muted">
              This pipeline has no stages yet. Add stages to start tracking deals.
            </div>
          ) : (
            <KanbanBoard
              stages={activePipeline.stages}
              initialOpportunities={opportunities
                .filter((o) => activePipeline.stages.some((s) => s.id === o.stageId))
                .map((o) => ({
                  id: o.id,
                  name: o.name,
                  valueCents: o.valueCents,
                  status: o.status,
                  stageId: o.stageId,
                  createdAt: o.createdAt.toISOString(),
                  contact: o.contact
                    ? { id: o.contact.id, firstName: o.contact.firstName, lastName: o.contact.lastName }
                    : null,
                }))}
            />
          )}
        </section>
      ) : null}

      {/* Forms */}
      <div className="grid gap-6 xl:grid-cols-2" id="new-pipeline">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="text-primary" size={18} />
              <h2 className="font-semibold">New Pipeline</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createPipeline} className="space-y-3">
              <Field label="Name" name="name" placeholder="Main sales pipeline" required />
              <SubmitButton
                className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold hover:bg-background transition"
                pendingText="Creating…"
              >
                Create pipeline
              </SubmitButton>
            </form>
          </CardBody>
        </Card>

        <Card id="new-opportunity">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="text-primary" size={18} />
              <h2 className="font-semibold">New Opportunity</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createOpportunity} className="space-y-3">
              <Field label="Name" name="name" placeholder="Website redesign deal" required />
              <Field label="Value ($)" name="value" type="number" defaultValue="0" />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Stage
                </span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  name="stageId"
                  required
                >
                  {allStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.pipelineName}: {stage.name}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90 transition"
                disabled={!allStages.length}
                pendingText="Creating…"
              >
                Create opportunity
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
