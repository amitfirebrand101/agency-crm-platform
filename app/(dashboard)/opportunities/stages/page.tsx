import Link from "next/link";
import { ArrowLeft, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import {
  addPipelineStage,
  createPipeline,
  deletePipelineStage,
  renamePipeline,
  renamePipelineStage,
} from "@/app/(dashboard)/module-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PipelineStagesPage() {
  const user = await requireUser();

  let databaseUnavailable = false;
  let pipelines: Awaited<ReturnType<typeof fetchPipelines>> = [];

  try {
    pipelines = await fetchPipelines(user.agencyId, user.subAccountId ?? undefined);
  } catch (error) {
    databaseUnavailable = true;
    console.error("Pipeline stages page database query failed", error);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline Management</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your pipelines and their stages.
          </p>
        </div>
        <Link
          href="/opportunities"
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted hover:bg-background hover:text-foreground transition"
        >
          <ArrowLeft size={14} />
          Back to Kanban
        </Link>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* New Pipeline form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="text-primary" size={18} />
            <h2 className="font-semibold">New Pipeline</h2>
          </div>
        </CardHeader>
        <CardBody>
          <form action={createPipeline} className="flex items-end gap-3">
            <div className="flex-1">
              <Field label="Name" name="name" placeholder="e.g. Sales, Onboarding, Renewals" required />
            </div>
            <SubmitButton
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
              pendingText="Creating…"
            >
              Create pipeline
            </SubmitButton>
          </form>
        </CardBody>
      </Card>

      {/* Pipeline cards */}
      {pipelines.length === 0 && !databaseUnavailable ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-panel py-16 text-center">
          <Layers className="mb-4 text-muted" size={40} />
          <h2 className="text-lg font-semibold">No pipelines yet</h2>
          <p className="mt-1 text-sm text-muted">
            Create your first pipeline above to get started.
          </p>
        </div>
      ) : null}

      {pipelines.map((pipeline) => (
        <Card key={pipeline.id}>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Rename pipeline */}
              <form action={renamePipeline} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="pipelineId" value={pipeline.id} />
                <Pencil className="shrink-0 text-muted" size={14} />
                <input
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold outline-none ring-primary/20 hover:border-border focus:border-border focus:ring-4 transition"
                  defaultValue={pipeline.name}
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  aria-label="Pipeline name"
                />
                <SubmitButton
                  className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-background transition"
                  pendingText="Saving…"
                >
                  Rename
                </SubmitButton>
              </form>
              <Badge variant="muted">{pipeline.stages.length} stage{pipeline.stages.length !== 1 ? "s" : ""}</Badge>
            </div>
          </CardHeader>

          <CardBody className="space-y-4">
            {/* Stage list */}
            {pipeline.stages.length === 0 ? (
              <p className="text-sm text-muted">No stages yet. Add the first stage below.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {pipeline.stages.map((stage) => {
                  const dealCount = stage._count.opportunities;
                  const canDelete = dealCount === 0;
                  return (
                    <li key={stage.id} className="flex items-center gap-3 px-4 py-3">
                      {/* Position badge */}
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold text-muted border border-border">
                        {stage.position}
                      </span>

                      {/* Rename form */}
                      <form action={renamePipelineStage} className="flex flex-1 items-center gap-2 min-w-0">
                        <input type="hidden" name="stageId" value={stage.id} />
                        <input
                          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium outline-none ring-primary/20 hover:border-border focus:border-border focus:ring-4 transition"
                          defaultValue={stage.name}
                          name="name"
                          required
                          minLength={1}
                          maxLength={80}
                          aria-label={`Rename stage ${stage.name}`}
                        />
                        <SubmitButton
                          className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-background transition"
                          pendingText="Saving…"
                        >
                          Save
                        </SubmitButton>
                      </form>

                      {/* Deal count badge */}
                      <Badge variant={dealCount > 0 ? "info" : "muted"}>
                        {dealCount} deal{dealCount !== 1 ? "s" : ""}
                      </Badge>

                      {/* Delete button */}
                      <form action={deletePipelineStage}>
                        <input type="hidden" name="stageId" value={stage.id} />
                        <SubmitButton
                          className={[
                            "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition",
                            canDelete
                              ? "border border-red-200 text-red-600 hover:bg-red-50"
                              : "border border-border text-muted cursor-not-allowed opacity-50",
                          ].join(" ")}
                          disabled={!canDelete}
                          pendingText="Deleting…"
                          title={canDelete ? "Delete stage" : "Move opportunities first"}
                        >
                          <Trash2 size={12} />
                          Delete
                        </SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Add stage form */}
            <form action={addPipelineStage} className="flex items-end gap-3 pt-1">
              <input type="hidden" name="pipelineId" value={pipeline.id} />
              <div className="flex-1">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    New Stage Name
                  </span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    name="name"
                    placeholder="e.g. Proposal, Negotiation, Closed"
                    required
                    minLength={1}
                    maxLength={80}
                  />
                </label>
              </div>
              <SubmitButton
                className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-background transition"
                pendingText="Adding…"
              >
                <Plus size={14} />
                Add Stage
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

async function fetchPipelines(agencyId: string, subAccountId: string | undefined) {
  return prisma.pipeline.findMany({
    where: { agencyId, subAccountId: subAccountId ?? undefined },
    include: {
      stages: {
        orderBy: { position: "asc" },
        include: { _count: { select: { opportunities: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
