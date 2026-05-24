import Link from "next/link";
import { Bot, ChevronRight, Clock, Plus, Zap } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createWorkflow, duplicateWorkflow } from "@/app/(dashboard)/automations/actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AutomationWithRuns = Prisma.AutomationGetPayload<{
  include: { runs: { orderBy: { startedAt: "desc" }; take: 1 } };
}>;

export default async function AutomationsPage() {
  try {
    return await AutomationsContent();
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("Automations page failed", error);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Automations</h1>
        <DbWarning />
      </div>
    );
  }
}

async function AutomationsContent() {
  const user = await requireUser();
  let automations: AutomationWithRuns[] = [];
  let databaseUnavailable = false;

  try {
    automations = await prisma.automation.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { updatedAt: "desc" },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 1 } }
    });
  } catch (err) {
    databaseUnavailable = true;
    console.error("Automations list query failed", err);
  }

  const published = automations.filter((a) => a.status === "published").length;
  const draft = automations.filter((a) => a.status === "draft").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Automations</h1>
          <p className="mt-1 text-sm text-muted">
            Build trigger-based workflows that run automatically for your contacts.
          </p>
        </div>
        <form action={createWorkflow}>
          <button
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
            type="submit"
          >
            <Plus size={15} />
            New Workflow
          </button>
        </form>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Stats */}
      {automations.length > 0 ? (
        <div className="grid grid-cols-3 gap-4 md:w-96">
          <Card>
            <CardBody>
              <div className="text-2xl font-bold">{automations.length}</div>
              <div className="text-xs text-muted mt-0.5">Total</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-2xl font-bold text-emerald-600">{published}</div>
              <div className="text-xs text-muted mt-0.5">Live</div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="text-2xl font-bold text-muted">{draft}</div>
              <div className="text-xs text-muted mt-0.5">Draft</div>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {/* Workflow list */}
      {automations.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="text-primary" size={17} />
              <h2 className="font-semibold">Workflows</h2>
            </div>
          </CardHeader>
          <div className="divide-y divide-border">
            {automations.map((automation) => {
              const lastRun = automation.runs[0] ?? null;
              return (
                <div className="flex items-center gap-4 px-5 py-4 hover:bg-background/50 transition" key={automation.id}>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${automation.status === "published" ? "bg-primary/10 text-primary" : "bg-muted/20 text-muted"}`}>
                    <Zap size={16} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{automation.name}</span>
                      <Badge variant={automation.status === "published" ? "success" : "muted"}>
                        {automation.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
                      {lastRun ? (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          Last run {new Date(lastRun.startedAt).toLocaleDateString()}
                          {" · "}
                          <Badge variant={statusVariant(lastRun.status)} className="text-[10px]">
                            {lastRun.status}
                          </Badge>
                        </span>
                      ) : (
                        <span>No runs yet</span>
                      )}
                      <span>Updated {new Date(automation.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={duplicateWorkflow}>
                      <input name="automationId" type="hidden" value={automation.id} />
                      <button
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-background hover:text-foreground transition"
                        type="submit"
                      >
                        Duplicate
                      </button>
                    </form>
                    <Link
                      className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                      href={`/automations/${automation.id}`}
                    >
                      Edit
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : !databaseUnavailable ? (
        <Card>
          <CardBody>
            <div className="py-12 text-center">
              <Bot className="mx-auto mb-4 text-muted" size={36} />
              <p className="font-semibold text-foreground">No workflows yet</p>
              <p className="mt-1 text-sm text-muted">Click &ldquo;New Workflow&rdquo; to build your first automation.</p>
              <form action={createWorkflow} className="mt-5 inline-block">
                <button
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
                  type="submit"
                >
                  <Plus size={15} />
                  Create first workflow
                </button>
              </form>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
