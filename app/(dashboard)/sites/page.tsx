import { ExternalLink, GalleryVerticalEnd, Globe, Plus } from "lucide-react";
import { createSite } from "@/app/(dashboard)/module-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
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
    sites = await prisma.site.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "desc" }
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Sites page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sites</h1>
        <p className="mt-1 text-sm text-muted">
          Manage client sites, funnels, and domains. Visual builder and form embedding coming soon.
        </p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          {sites.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {sites.map((site) => (
                <Card key={site.id}>
                  <CardBody>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <GalleryVerticalEnd size={20} />
                      </div>
                      <Badge variant={statusVariant(site.status)}>{site.status}</Badge>
                    </div>
                    <h2 className="font-semibold">{site.name}</h2>
                    {site.domain ? (
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                        <Globe size={12} />
                        <span>{site.domain}</span>
                        <ExternalLink size={12} />
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted">No domain connected</p>
                    )}
                    <p className="mt-3 text-xs text-muted">Created {new Date(site.createdAt).toLocaleDateString()}</p>
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardBody>
                <div className="py-8 text-center">
                  <GalleryVerticalEnd className="mx-auto mb-4 text-muted" size={32} />
                  <p className="font-medium">No sites yet</p>
                  <p className="mt-1 text-sm text-muted">Create your first site to track client web projects and domains.</p>
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <div className="rounded-md border border-border bg-background p-4 text-sm text-muted">
                <p className="font-semibold text-foreground">Visual builder coming soon</p>
                <p className="mt-1">
                  Page builder, form embedding, and funnel analytics are planned for a future release.
                  For now, use site records to track client projects and domain assignments.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="text-primary" size={18} />
              <h2 className="font-semibold">New site</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createSite} className="space-y-3">
              <Field label="Name" name="name" placeholder="Client landing pages" required />
              <Field label="Domain" name="domain" placeholder="example.com" />
              <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">
                Create site
              </button>
            </form>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
