import { Plus, Tags } from "lucide-react";
import { createContact, createCustomField, createTag } from "@/app/(dashboard)/contacts/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ContactsPage() {
  const user = await requireUser();
  const [contacts, tags, customFields] = await Promise.all([
    prisma.contact.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "desc" },
      include: { tags: { include: { tag: true } } }
    }),
    prisma.tag.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { name: "asc" }
    }),
    prisma.customField.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <p className="mt-1 text-sm text-muted">
          Tenant-scoped contact management with tags, custom fields, consent flags, source attribution, and audit logging.
        </p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold">Contact records</h2>
              <span className="rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted">{contacts.length} total</span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-background text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="px-4 py-4 font-semibold">
                      {contact.firstName} {contact.lastName}
                    </td>
                    <td className="px-4 py-4 text-muted">{contact.email ?? "-"}</td>
                    <td className="px-4 py-4 text-muted">{contact.phone ?? "-"}</td>
                    <td className="px-4 py-4 text-muted">{contact.source ?? "Direct"}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {contact.tags.map(({ tag }) => (
                          <span className="rounded-md px-2 py-1 text-xs font-semibold text-white" key={tag.id} style={{ backgroundColor: tag.color }}>
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

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
                <Field label="Phone" name="phone" />
                <Field label="Company" name="companyName" />
                <Field label="Source" name="source" />
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
                <input className="rounded-md border border-border bg-background px-3 py-2 text-sm" name="name" placeholder="Tag name" required />
                <input className="h-10 rounded-md border border-border bg-background p-1" defaultValue="#0e7490" name="color" type="color" />
                <button className="col-span-2 rounded-md border border-border px-3 py-2 text-sm font-semibold" type="submit">
                  Add tag
                </button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span className="rounded-md px-2 py-1 text-xs font-semibold text-white" key={tag.id} style={{ backgroundColor: tag.color }}>
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
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="type" defaultValue="TEXT">
                  <option value="TEXT">Text</option>
                  <option value="NUMBER">Number</option>
                  <option value="DATE">Date</option>
                  <option value="SELECT">Select</option>
                  <option value="BOOLEAN">Boolean</option>
                  <option value="URL">URL</option>
                </select>
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
