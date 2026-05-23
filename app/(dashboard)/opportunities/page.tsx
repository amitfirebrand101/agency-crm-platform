import { Plus, Target } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createOpportunity, createPipeline } from "@/app/(dashboard)/module-actions";
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

  const stages = pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => ({ ...stage, pipelineName: pipeline.name })));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Opportunities</h1><p className="mt-1 text-sm text-muted">Pipelines, stages, and deal records for agency sales workflows.</p></div>
      {databaseUnavailable ? <DbWarning /> : null}
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader><div className="flex items-center gap-2"><Target className="text-primary" size={18} /><h2 className="font-semibold">Deals</h2></div></CardHeader>
            <CardBody>
              <div className="divide-y divide-border">
                {opportunities.map((opportunity) => (
                  <div className="flex items-center justify-between gap-4 py-3" key={opportunity.id}>
                    <div><div className="font-medium">{opportunity.name}</div><div className="text-sm text-muted">{opportunity.stage.name}</div></div>
                    <div className="text-sm font-semibold">${(opportunity.valueCents / 100).toLocaleString()}</div>
                  </div>
                ))}
                {!opportunities.length ? <div className="py-6 text-sm text-muted">No opportunities yet.</div> : null}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader><h2 className="font-semibold">Pipelines</h2></CardHeader>
            <CardBody><div className="grid gap-3 md:grid-cols-2">{pipelines.map((pipeline) => <div className="rounded-md border border-border bg-background p-3" key={pipeline.id}><div className="font-medium">{pipeline.name}</div><div className="mt-1 text-sm text-muted">{pipeline.stages.length} stages</div></div>)}</div></CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <Card><CardHeader><div className="flex items-center gap-2"><Plus className="text-primary" size={18} /><h2 className="font-semibold">New pipeline</h2></div></CardHeader><CardBody><form action={createPipeline} className="space-y-3"><Field label="Name" name="name" placeholder="Main sales pipeline" required /><button className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold" type="submit">Create pipeline</button></form></CardBody></Card>
          <Card><CardHeader><h2 className="font-semibold">New opportunity</h2></CardHeader><CardBody><form action={createOpportunity} className="space-y-3"><Field label="Name" name="name" placeholder="Website redesign deal" required /><Field label="Value" name="value" type="number" defaultValue="0" /><select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="stageId" required>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.pipelineName}: {stage.name}</option>)}</select><button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!stages.length} type="submit">Create opportunity</button></form></CardBody></Card>
        </div>
      </section>
    </div>
  );
}
