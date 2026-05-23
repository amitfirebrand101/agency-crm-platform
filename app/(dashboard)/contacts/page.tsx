import Link from "next/link";
import { Plus, Tags, UserRound } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createContact, createCustomField, createTag } from "@/app/(dashboard)/contacts/actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ContactWithTags = Prisma.ContactGetPayload<{ include: { tags: { include: { tag: true } } } }>;

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

  try {
    const where: Prisma.ContactWhereInput = {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined,
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

    [contacts, tags, customFields, totalContacts] = await Promise.all([
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
      prisma.contact.count({ where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined } })
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

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <UserRound className="text-primary" size={18} />
                  <h2 className="font-semibold">Contact records</h2>
                  <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">{totalContacts}</span>
                </div>
                <form className="flex gap-2" method="GET">
                  <input
                    className="h-9 w-48 rounded-md border border-border bg-background px-3 text-sm outline-none ring-primary/20 focus:ring-4"
                    defaultValue={query}
                    name="q"
                    placeholder="Search contacts…"
                  />
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-sm">
                <thead className="bg-background text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contacts.map((contact) => (
                    <tr className="transition hover:bg-background" key={contact.id}>
                      <td className="px-4 py-3">
                        <Link
                          className="font-semibold text-foreground hover:text-primary"
                          href={`/contacts/${contact.id}`}
                        >
                          {contact.firstName} {contact.lastName ?? ""}
                        </Link>
                        {contact.companyName ? (
                          <div className="text-xs text-muted">{contact.companyName}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">{contact.email ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{contact.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(contact.status)}>{contact.status}</Badge>
                      </td>
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
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!contacts.length ? (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted" colSpan={5}>
                        {query || statusFilter ? "No contacts match your filter." : "No contacts yet. Add your first one."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

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
                <Field label="First name" name="firstName" required />
                <Field label="Last name" name="lastName" />
                <Field label="Email" name="email" type="email" />
                <Field label="Phone" name="phone" type="tel" />
                <Field label="Company" name="companyName" />
                <Field label="Source" name="source" placeholder="Website, referral…" />
                <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">
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
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  name="name"
                  placeholder="Tag name"
                  required
                />
                <input className="h-10 rounded-md border border-border bg-background p-1" defaultValue="#0e7490" name="color" type="color" />
                <button className="col-span-2 rounded-md border border-border px-3 py-2 text-sm font-semibold" type="submit">
                  Add tag
                </button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span className="rounded px-2 py-0.5 text-xs font-semibold text-white" key={tag.id} style={{ backgroundColor: tag.color }}>
                    {tag.name}
                  </span>
                ))}
              </div>
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
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" defaultValue="TEXT" name="type">
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="DATE">Date</option>
                    <option value="SELECT">Select</option>
                    <option value="BOOLEAN">Boolean</option>
                    <option value="URL">URL</option>
                  </select>
                </label>
                <button className="w-full rounded-md border border-border px-3 py-2 text-sm font-semibold" type="submit">
                  Add field
                </button>
              </form>
              <div className="mt-3 space-y-2">
                {customFields.map((field) => (
                  <div className="flex items-center justify-between rounded-md bg-background px-3 py-2 text-sm" key={field.id}>
                    <span>{field.name}</span>
                    <span className="text-xs font-semibold text-muted">{field.type}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
