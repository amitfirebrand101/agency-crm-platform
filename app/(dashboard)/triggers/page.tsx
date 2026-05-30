import { ExternalLink, Link2, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTriggerLink, deleteTriggerLink } from "./actions";

const createTriggerLinkAction = createTriggerLink as (formData: FormData) => Promise<void>;
const deleteTriggerLinkAction = deleteTriggerLink as (formData: FormData) => Promise<void>;

function truncateUrl(url: string, maxLength = 40) {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength).trimEnd() + "…";
}

export default async function TriggerLinksPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let links: Awaited<ReturnType<typeof prisma.triggerLink.findMany>> = [];

  try {
    links = await prisma.triggerLink.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Trigger links page database query failed", error);
  }

  const totalClicks = links.reduce((sum, l) => sum + l.clickCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Trigger Links</h1>
          <p className="mt-1 text-sm text-muted">
            Trackable redirect URLs that can enroll contacts into automations on click.
          </p>
        </div>
        {links.length > 0 ? (
          <article className="rounded-lg border border-border bg-panel p-4 shadow-soft text-right">
            <div className="text-sm text-muted">Total clicks</div>
            <div className="mt-1 text-2xl font-semibold">{totalClicks}</div>
          </article>
        ) : null}
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Link2 className="text-primary" size={18} />
              <h2 className="font-semibold">Trigger Links</h2>
              <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                {links.length}
              </span>
            </div>
          </CardHeader>
          <CardBody>
            {links.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Slug</th>
                      <th className="pb-2 pr-4">Redirect URL</th>
                      <th className="pb-2 pr-4 text-right">Clicks</th>
                      <th className="pb-2 pr-4">Created</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {links.map((link) => (
                      <tr key={link.id}>
                        <td className="py-3 pr-4 font-medium">{link.name}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-muted">
                          /{link.slug}
                        </td>
                        <td className="py-3 pr-4">
                          <a
                            className="flex items-center gap-1 text-primary hover:underline"
                            href={link.redirectUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                            title={link.redirectUrl}
                          >
                            <ExternalLink size={11} />
                            {truncateUrl(link.redirectUrl)}
                          </a>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <Badge variant={link.clickCount > 0 ? "info" : "muted"}>
                            <MousePointerClick size={11} className="mr-1" />
                            {link.clickCount}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted">
                          {new Date(link.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          <form action={deleteTriggerLinkAction}>
                            <input type="hidden" name="id" value={link.id} />
                            <SubmitButton
                              className="rounded p-1 text-muted hover:bg-background hover:text-danger"
                              pendingText="…"
                              title="Delete trigger link"
                            >
                              <Trash2 size={14} />
                            </SubmitButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Link2 className="mx-auto mb-4 text-muted" size={32} />
                <p className="font-medium">No trigger links yet</p>
                <p className="mt-1 text-sm text-muted">
                  Create a trigger link to track clicks and enroll contacts into automations.
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">New Trigger Link</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createTriggerLinkAction} className="space-y-3">
                <Field label="Name" name="name" placeholder="Summer promo click" required />

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Slug
                  </span>
                  <div className="flex items-center rounded-md border border-border bg-background text-sm ring-primary/20 focus-within:ring-4">
                    <span className="select-none border-r border-border bg-panel px-3 py-2 text-muted rounded-l-md">
                      /
                    </span>
                    <input
                      className="flex-1 bg-transparent px-3 py-2 outline-none"
                      name="slug"
                      pattern="[a-z0-9-]+"
                      placeholder="summer-promo"
                      required
                      title="Lowercase letters, numbers, and hyphens only"
                      type="text"
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Lowercase letters, numbers, and hyphens only.
                  </p>
                </label>

                <Field
                  label="Redirect URL"
                  name="redirectUrl"
                  placeholder="https://yoursite.com/offer"
                  required
                  type="url"
                />

                <SubmitButton
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white"
                  pendingText="Creating…"
                >
                  Create trigger link
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                How it works
              </p>
              <ol className="space-y-1.5 text-sm text-muted list-decimal list-inside">
                <li>Share the trigger link with your contacts.</li>
                <li>Each click is tracked and logged.</li>
                <li>Optionally enroll the contact into an automation on click.</li>
              </ol>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
