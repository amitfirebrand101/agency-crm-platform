import { Megaphone, Plus } from "lucide-react";
import { createMarketingCampaign } from "@/app/(dashboard)/module-actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function MarketingPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let campaigns: Awaited<ReturnType<typeof prisma.marketingCampaign.findMany>> = [];

  try {
    campaigns = await prisma.marketingCampaign.findMany({ where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined }, orderBy: { createdAt: "desc" } });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Marketing page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Marketing</h1><p className="mt-1 text-sm text-muted">Campaign records for email, SMS, and future audience segments.</p></div>
      {databaseUnavailable ? <DbWarning /> : null}
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card><CardHeader><div className="flex items-center gap-2"><Megaphone className="text-primary" size={18} /><h2 className="font-semibold">Campaigns</h2></div></CardHeader><CardBody><div className="divide-y divide-border">{campaigns.map((campaign) => <div className="flex items-center justify-between py-3" key={campaign.id}><div><div className="font-medium">{campaign.name}</div><div className="text-sm text-muted">{campaign.channel}</div></div><span className="rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted">{campaign.status}</span></div>)}{!campaigns.length ? <div className="py-6 text-sm text-muted">No campaigns yet.</div> : null}</div></CardBody></Card>
        <Card><CardHeader><div className="flex items-center gap-2"><Plus className="text-primary" size={18} /><h2 className="font-semibold">New campaign</h2></div></CardHeader><CardBody><form action={createMarketingCampaign} className="space-y-3"><Field label="Name" name="name" placeholder="Spring lead push" required /><Field label="Channel" name="channel" placeholder="Email" required /><button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">Create campaign</button></form></CardBody></Card>
      </section>
    </div>
  );
}
