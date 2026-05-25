import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, Globe, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPage, deletePage, updateSiteSettings } from "@/app/(dashboard)/sites/[siteId]/actions";

type SiteWithPages = Prisma.SiteGetPayload<{
  include: {
    pages: {
      orderBy: { createdAt: "desc" };
      include: { versions: { orderBy: { createdAt: "desc" }; take: 1 } };
    };
  };
}>;

export default async function SiteDetailPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireUser();

  let site: SiteWithPages | null = null;
  try {
    site = await prisma.site.findFirst({
      where: { id: siteId, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      include: {
        pages: {
          orderBy: { createdAt: "desc" },
          include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
        },
      },
    });
  } catch (err) {
    console.error("Site detail query failed", err);
  }

  if (!site) {
    notFound();
  }

  const published = site.pages.filter((p) => p.status === "published").length;
  const drafts = site.pages.filter((p) => p.status === "draft").length;
  const archived = site.pages.filter((p) => p.status === "archived").length;

  return (
    <div className="space-y-6">
      <Link href="/sites?tab=websites" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-foreground">
        <ArrowLeft size={15} /> Back to Sites
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-100">
            <Globe className="text-cyan-700" size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{site.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              {site.domain ? (
                <span className="flex items-center gap-1">
                  <Globe size={12} /> {site.domain}
                </span>
              ) : (
                <span>No custom domain</span>
              )}
              <Badge variant={statusVariant(site.status)}>{site.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <CountPill label="Published" value={published} />
          <CountPill label="Drafts" value={drafts} />
          <CountPill label="Archived" value={archived} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Pages */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="text-primary" size={17} />
            <h2 className="font-semibold">Pages</h2>
          </div>

          {site.pages.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {site.pages.map((page) => (
                <Card key={page.id} className="flex flex-col transition hover:border-primary">
                  <CardBody className="flex flex-1 flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold leading-snug">{page.title}</h3>
                        <p className="mt-0.5 truncate font-mono text-xs text-muted">/{page.slug}</p>
                      </div>
                      <Badge variant={statusVariant(page.status)}>{page.status}</Badge>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
                      <form action={deletePage}>
                        <input type="hidden" name="pageId" value={page.id} />
                        <SubmitButton
                          className="rounded px-2 py-1 text-[11px] text-muted transition hover:bg-red-50 hover:text-red-600"
                          pendingText="Deleting…"
                        >
                          Delete
                        </SubmitButton>
                      </form>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/sites/${site.id}/pages/${page.id}/preview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-background"
                        >
                          Preview <ExternalLink size={11} />
                        </Link>
                        <Link
                          href={`/sites/${site.id}/pages/${page.id}/builder`}
                          className="flex items-center gap-0.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-muted/20 text-muted">
                <FileText size={28} />
              </div>
              <p className="font-semibold">No pages yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
                Add your first page and start designing with the drag-and-drop builder.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={17} />
                <h2 className="font-semibold">New Page</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createPage} className="space-y-3">
                <input type="hidden" name="siteId" value={site.id} />
                <Field label="Page Title" name="title" placeholder="Home" required />
                <Field label="Slug" name="slug" placeholder="home" required />
                <SubmitButton
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                  pendingText="Creating…"
                >
                  Create Page
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Site Settings</h2>
            </CardHeader>
            <CardBody>
              <form action={updateSiteSettings} className="space-y-3">
                <input type="hidden" name="siteId" value={site.id} />
                <Field label="Site Name" name="name" defaultValue={site.name} required />
                <Field label="Custom Domain" name="domain" defaultValue={site.domain ?? ""} placeholder="www.yourdomain.com" />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Status</span>
                  <select
                    name="status"
                    defaultValue={site.status}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <SubmitButton
                  className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold transition hover:bg-background"
                  pendingText="Saving…"
                >
                  Save Settings
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-panel px-3 py-1.5 text-center">
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
