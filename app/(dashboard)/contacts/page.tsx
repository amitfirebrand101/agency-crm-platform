import Link from "next/link";
import { Plus, Search, Tags, UserRound } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createContact, createCustomField, createTag } from "@/app/(dashboard)/contacts/actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ContactWithTags = Prisma.ContactGetPayload<{ include: { tags: { include: { tag: true } } } }>;

const AVATAR_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#6366f1"];
function avatarBg(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

export default async function ContactsPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const statusFilter = params?.status ?? "";

  const user = await requireUser();
  let databaseUnavailable = false;
  let contacts: ContactWithTags[] = [];
  let tags: Awaited<ReturnType<typeof prisma.tag.findMany>> = [];
  let customFields: Awaited<ReturnType<typeof prisma.customField.findMany>> = [];
  let totalContacts = 0;
  let leadsCount = 0;
  let customersCount = 0;

  try {
    const baseWhere: Prisma.ContactWhereInput = {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined
    };

    const where: Prisma.ContactWhereInput = {
      ...baseWhere,
      ...(statusFilter ? { status: statusFilter as Prisma.EnumContactStatusFilter } : {}),
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { companyName: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    };

    [contacts, tags, customFields, totalContacts, leadsCount, customersCount] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { tags: { include: { tag: true } } }
      }),
      prisma.tag.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { name: "asc" }
      }),
      prisma.customField.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { name: "asc" }
      }),
      prisma.contact.count({ where: baseWhere }),
      prisma.contact.count({ where: { ...baseWhere, status: "LEAD" } }),
      prisma.contact.count({ where: { ...baseWhere, status: "CUSTOMER" } })
    ]);
  } catch (error) {
    databaseUnavailable = true;
    console.error("Contacts page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <p className="mt-1 text-sm text-muted">
          Tenant-scoped CRM records with tags, custom fields, source attribution, and per-contact timelines.
        </p>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Total Contacts</p>
          <p className="mt-1 text-2xl font-bold">{totalContacts}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Leads</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{leadsCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Customers</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{customersCount}</p>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <UserRound className="text-primary" size={18} />
                  <h2 className="font-semibold">Contact records</h2>
                  <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                    {contacts.length}
                  </span>
                </div>
                <form className="flex flex-wrap items-center gap-2" method="GET">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
                    <input
                      className="h-9 w-52 rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none ring-primary/20 focus:ring-4"
                      defaultValue={query}
                      name="q"
                      placeholder="Search contacts…"
                    />
                  </div>
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                    defaultValue={statusFilter}
                    name="status"
                  >
                    <option value="">All statuses</option>
                    <option value="LEAD">Lead</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                  <button className="h-9 rounded-md border border-border px-3 text-sm font-medium" type="submit">
                    Filter
                  </button>
                </form>
              </div>
            </CardHeader>

            {contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-background">
                  <UserRound className="text-muted" size={28} />
                </div>
                <p className="text-base font-semibold">
                  {query || statusFilter ? "No contacts match your filter" : "No contacts yet"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {query || statusFilter
                    ? "Try adjusting your search or clearing the filter."
                    : "Add your first contact using the form on the right."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b border-border bg-background text-muted">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Contact</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Phone</th>
                      <th className="px-4 py-3 font-semibold">Tags</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Added</th>
                      <th className="px-4 py-3 font-semibold sr-only">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {contacts.map((contact) => {
                      const fullName = `${contact.firstName} ${contact.lastName ?? ""}`.trim();
                      const initial = fullName.charAt(0).toUpperCase();
                      return (
                        <tr className="transition hover:bg-background" key={contact.id}>
                          {/* Contact */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                                style={{ backgroundColor: avatarBg(fullName) }}
                              >
                                {initial}
                              </div>
                              <div>
                                <Link
                                  className="font-semibold text-foreground hover:text-primary"
                                  href={`/contacts/${contact.id}`}
                                >
                                  {fullName}
                                </Link>
                                {contact.companyName ? (
                                  <div className="text-xs text-muted">{contact.companyName}</div>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="px-4 py-3">
                            {contact.email ? (
                              <a
                                className="text-primary hover:underline"
                                href={`mailto:${contact.email}`}
                              >
                                {contact.email}
                              </a>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>

                          {/* Phone */}
                          <td className="px-4 py-3">
                            {contact.phone ? (
                              <a
                                className="text-foreground hover:text-primary hover:underline"
                                href={`tel:${contact.phone}`}
                              >
                                {contact.phone}
                              </a>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>

                          {/* Tags */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {contact.tags.map(({ tag }) => (
                                <span
                                  className="rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                                  key={tag.id}
                                  style={{ backgroundColor: tag.color }}
                                >
                                  {tag.name}
                                </span>
                              ))}
                              {!contact.tags.length ? <span className="text-muted">—</span> : null}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <Badge variant={statusVariant(contact.status)}>{contact.status}</Badge>
                          </td>

                          {/* Added */}
                          <td className="px-4 py-3 text-muted">
                            {new Date(contact.createdAt).toLocaleDateString()}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <Link
                              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:bg-background"
                              href={`/contacts/${contact.id}`}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">New contact</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createContact} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" name="firstName" required />
                  <Field label="Last name" name="lastName" />
                </div>
                <Field label="Email" name="email" type="email" />
                <Field label="Phone" name="phone" type="tel" />
                <Field label="Company" name="companyName" />
                <Field label="Source" name="source" placeholder="Website, referral…" />
                <button
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  type="submit"
                >
                  Create contact
                </button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tags className="text-primary" size={18} />
                <h2 className="font-semibold">Tags</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createTag} className="grid grid-cols-[1fr_4rem] gap-2">
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                  name="name"
                  placeholder="Tag name"
                  required
                />
                <input
                  className="h-10 rounded-md border border-border bg-background p-1"
                  defaultValue="#0e7490"
                  name="color"
                  type="color"
                />
                <button
                  className="col-span-2 rounded-md border border-border px-3 py-2 text-sm font-semibold transition hover:bg-background"
                  type="submit"
                >
                  Add tag
                </button>
              </form>
              {tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      className="rounded px-2 py-0.5 text-xs font-semibold text-white"
                      key={tag.id}
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Custom fields</h2>
            </CardHeader>
            <CardBody>
              <form action={createCustomField} className="space-y-3">
                <Field label="Label" name="name" placeholder="Lead budget" required />
                <Field label="Key" name="key" placeholder="lead-budget" required />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Type</span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    defaultValue="TEXT"
                    name="type"
                  >
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="DATE">Date</option>
                    <option value="SELECT">Select</option>
                    <option value="BOOLEAN">Boolean</option>
                    <option value="URL">URL</option>
                  </select>
                </label>
                <button
                  className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold transition hover:bg-background"
                  type="submit"
                >
                  Add field
                </button>
              </form>
              {customFields.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {customFields.map((field) => (
                    <div
                      className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm"
                      key={field.id}
                    >
                      <span>{field.name}</span>
                      <span className="text-xs font-semibold text-muted">{field.type}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
