import { Plus, Target } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createOpportunity, createPipeline, moveOpportunityToStage, updateOpportunityStatus } from "@/app/(dashboard)/module-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PipelineWithStages = Prisma.PipelineGetPayload<{ include: { stages: { orderBy: { position: "asc" } } } }>;
type OpportunityWithRelations = Prisma.OpportunityGetPayload<{ include: { stage: true; contact: true } }>;

export default async function OpportunitiesPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let pipelines: PipelineWithStages[] = [];
  let opportunities: OpportunityWithRelations[] = [];

  try {
    [pipelines, opportunities] = await Promise.all([
      prisma.pipeline.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { createdAt: "asc" },
        include: { stages: { orderBy: { position: "asc" } } }
      }),
      prisma.opportunity.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { createdAt: "desc" },
        include: { stage: true, contact: true }
      })
    ]);
  } catch (error) {
    databaseUnavailable = true;
    console.error("Opportunities page database query failed", error);
  }

  const allStages = pipelines.flatMap((p) => p.stages.map((s) => ({ ...s, pipelineName: p.name })));
  const openValue = opportunities.filter((o) => o.status === "OPEN").reduce((s, o) => s + o.valueCents, 0);
  const wonValue = opportunities.filter((o) => o.status === "WON").reduce((s, o) => s + o.valueCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Opportunities</h1>
        <p className="mt-1 text-sm text-muted">Pipelines, stages, and deal tracking for your agency sales workflows.</p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-sm text-muted">Open deals</p>
          <p className="mt-1 text-2xl font-semibold">{opportunities.filter((o) => o.status === "OPEN").length}</p>
          <p className="text-sm text-muted">${(openValue / 100).toLocaleString()} pipeline value</p>
        </article>
        <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-sm text-muted">Won</p>
          <p className="mt-1 text-2xl font-semibold">{opportunities.filter((o) => o.status === "WON").length}</p>
          <p className="text-sm text-muted">${(wonValue / 100).toLocaleString()} closed</p>
        </article>
        <article className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-sm text-muted">Pipelines</p>
          <p className="mt-1 text-2xl font-semibold">{pipelines.length}</p>
          <p className="text-sm text-muted">{allStages.length} total stages</p>
        </article>
      </div>

      {/* Kanban board */}
      {pipelines.map((pipeline) => {
        const stages = pipeline.stages;
        return (
          <section key={pipeline.id}>
            <div className="mb-4 flex items-center gap-3">
              <Target className="text-primary" size={18} />
              <h2 className="font-semibold">{pipeline.name}</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {stages.map((stage) => {
                const stageOpps = opportunities.filter((o) => o.stageId === stage.id);
                const stageValue = stageOpps.reduce((s, o) => s + o.valueCents, 0);
                return (
                  <div className="w-64 shrink-0" key={stage.id}>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="font-semibold text-sm">{stage.name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted">
                        <span>{stageOpps.length}</span>
                        <span>·</span>
                        <span>${(stageValue / 100).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {stageOpps.map((opp) => (
                        <div className="rounded-lg border border-border bg-panel p-3 shadow-soft" key={opp.id}>
                          <div className="font-medium text-sm">{opp.name}</div>
                          {opp.contact ? (
                            <div className="mt-1 text-xs text-muted">
                              {opp.contact.firstName} {opp.contact.lastName ?? ""}
                            </div>
                          ) : null}
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">${(opp.valueCents / 100).toLocaleString()}</span>
                            <Badge variant={statusVariant(opp.status)}>{opp.status}</Badge>
                          </div>
                          {/* Move to stage */}
                          {stages.length > 1 ? (
                            <form action={moveOpportunityToStage} className="mt-2 flex gap-1">
                              <input name="opportunityId" type="hidden" value={opp.id} />
                              <select className="flex-1 rounded border border-border bg-background px-1.5 py-1 text-xs" defaultValue={opp.stageId} name="stageId">
                                {stages.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                              <button className="rounded border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-primary hover:text-white hover:border-primary transition" type="submit">
                                Move
                              </button>
                            </form>
                          ) : null}
                          {/* Status toggle */}
                          {opp.status === "OPEN" ? (
                            <div className="mt-2 flex gap-1">
                              <form action={updateOpportunityStatus} className="flex-1">
                                <input name="opportunityId" type="hidden" value={opp.id} />
                                <input name="status" type="hidden" value="WON" />
                                <button className="w-full rounded border border-green-200 bg-green-50 px-1.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition" type="submit">Won</button>
                              </form>
                              <form action={updateOpportunityStatus} className="flex-1">
                                <input name="opportunityId" type="hidden" value={opp.id} />
                                <input name="status" type="hidden" value="LOST" />
                                <button className="w-full rounded border border-red-200 bg-red-50 px-1.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition" type="submit">Lost</button>
                              </form>
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {!stageOpps.length ? (
                        <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted text-center">
                          No deals in this stage
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Forms */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="text-primary" size={18} />
              <h2 className="font-semibold">New pipeline</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createPipeline} className="space-y-3">
              <Field label="Name" name="name" placeholder="Main sales pipeline" required />
              <button className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold" type="submit">
                Create pipeline
              </button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold">New opportunity</h2>
          </CardHeader>
          <CardBody>
            <form action={createOpportunity} className="space-y-3">
              <Field label="Name" name="name" placeholder="Website redesign deal" required />
              <Field label="Value ($)" name="value" type="number" defaultValue="0" />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Stage</span>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="stageId" required>
                  {allStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.pipelineName}: {stage.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!allStages.length}
                type="submit"
              >
                Create opportunity
              </button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
