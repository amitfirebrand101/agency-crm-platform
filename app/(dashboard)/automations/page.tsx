import { Bot, Plus } from "lucide-react";
import { createAutomation } from "@/app/(dashboard)/module-actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AutomationsPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let automations: Awaited<ReturnType<typeof prisma.automation.findMany>> = [];

  try {
    automations = await prisma.automation.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "desc" }
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Automations page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Automations</h1><p className="mt-1 text-sm text-muted">Draft workflow records ready for trigger/action execution later.</p></div>
      {databaseUnavailable ? <DbWarning /> : null}
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card><CardHeader><div className="flex items-center gap-2"><Bot className="text-primary" size={18} /><h2 className="font-semibold">Workflows</h2></div></CardHeader><CardBody><div className="divide-y divide-border">{automations.map((automation) => <div className="flex items-center justify-between py-3" key={automation.id}><div className="font-medium">{automation.name}</div><span className="rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted">{automation.status}</span></div>)}{!automations.length ? <div className="py-6 text-sm text-muted">No automations yet.</div> : null}</div></CardBody></Card>
        <Card><CardHeader><div className="flex items-center gap-2"><Plus className="text-primary" size={18} /><h2 className="font-semibold">New automation</h2></div></CardHeader><CardBody><form action={createAutomation} className="space-y-3"><Field label="Name" name="name" placeholder="New lead nurture" required /><button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">Create automation</button></form></CardBody></Card>
      </section>
    </div>
  );
}
