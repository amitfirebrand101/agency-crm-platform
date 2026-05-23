import { GalleryVerticalEnd, Plus } from "lucide-react";
import { createSite } from "@/app/(dashboard)/module-actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SitesPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let sites: Awaited<ReturnType<typeof prisma.site.findMany>> = [];

  try {
    sites = await prisma.site.findMany({ where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined }, orderBy: { createdAt: "desc" } });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Sites page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Sites</h1><p className="mt-1 text-sm text-muted">Track client sites and domains before builder/publishing work starts.</p></div>
      {databaseUnavailable ? <DbWarning /> : null}
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid gap-4 md:grid-cols-2">{sites.map((site) => <Card key={site.id}><CardBody><GalleryVerticalEnd className="mb-4 text-primary" size={20} /><h2 className="font-semibold">{site.name}</h2><p className="mt-1 text-sm text-muted">{site.domain ?? "No domain connected"}</p><span className="mt-4 inline-block rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted">{site.status}</span></CardBody></Card>)}</div>
        <Card><CardHeader><div className="flex items-center gap-2"><Plus className="text-primary" size={18} /><h2 className="font-semibold">New site</h2></div></CardHeader><CardBody><form action={createSite} className="space-y-3"><Field label="Name" name="name" placeholder="Client landing pages" required /><Field label="Domain" name="domain" placeholder="example.com" /><button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">Create site</button></form></CardBody></Card>
      </section>
    </div>
  );
}
