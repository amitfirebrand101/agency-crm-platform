import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MessageSquareText, Pencil, Tag, Target, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { assignTagToContact, deleteContact, removeTagFromContact, updateContact } from "@/app/(dashboard)/contacts/actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

type ContactDetail = Prisma.ContactGetPayload<{
  include: {
    tags: { include: { tag: true } };
    conversations: { orderBy: { createdAt: "desc" }; take: 10 };
    appointments: { orderBy: { startsAt: "desc" }; take: 10; include: { calendar: true } };
    opportunities: { orderBy: { createdAt: "desc" }; take: 10; include: { stage: { include: { pipeline: true } } } };
  };
}>;

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  let contact: ContactDetail | null = null;
  let tags: Awaited<ReturnType<typeof prisma.tag.findMany>> = [];

  try {
    [contact, tags] = await Promise.all([
      prisma.contact.findFirst({
        where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        include: {
          tags: { include: { tag: true } },
          conversations: { orderBy: { createdAt: "desc" }, take: 10 },
          appointments: { orderBy: { startsAt: "desc" }, take: 10, include: { calendar: true } },
          opportunities: { orderBy: { createdAt: "desc" }, take: 10, include: { stage: { include: { pipeline: true } } } }
        }
      }),
      prisma.tag.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { name: "asc" }
      })
    ]);
  } catch (error) {
    console.error("Contact detail page database query failed", error);
  }

  if (!contact) notFound();

  const assignedTagIds = new Set(contact.tags.map((ct) => ct.tagId));
  const availableTags = tags.filter((t) => !assignedTagIds.has(t.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground" href="/contacts">
          <ArrowLeft size={15} />
          Contacts
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {contact.firstName} {contact.lastName ?? ""}
          </h1>
          {contact.companyName ? <p className="text-sm text-muted">{contact.companyName}</p> : null}
        </div>
        <Badge variant={statusVariant(contact.status)}>{contact.status}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {/* Edit contact */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Pencil className="text-primary" size={16} />
                <h2 className="font-semibold">Contact info</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={updateContact} className="space-y-3">
                <input name="contactId" type="hidden" value={contact.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="First name" name="firstName" defaultValue={contact.firstName} required />
                  <Field label="Last name" name="lastName" defaultValue={contact.lastName ?? ""} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Email" name="email" type="email" defaultValue={contact.email ?? ""} />
                  <Field label="Phone" name="phone" type="tel" defaultValue={contact.phone ?? ""} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Company" name="companyName" defaultValue={contact.companyName ?? ""} />
                  <Field label="Source" name="source" defaultValue={contact.source ?? ""} />
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Status</span>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" defaultValue={contact.status} name="status">
                    <option value="LEAD">Lead</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
                <div className="flex gap-3">
                  <button className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">
                    Save changes
                  </button>
                </div>
              </form>
            </CardBody>
          </Card>

          {/* Activity timeline */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Activity timeline</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {contact.conversations.map((conv) => (
                  <div className="flex items-start gap-3" key={conv.id}>
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <MessageSquareText size={14} />
                    </div>
                    <div>
                      <Link className="text-sm font-medium hover:text-primary" href={`/conversations/${conv.id}`}>
                        {conv.subject ?? `${conv.channel} conversation`}
                      </Link>
                      <div className="flex gap-2">
                        <Badge variant={statusVariant(conv.status)}>{conv.status}</Badge>
                        <span className="text-xs text-muted">{conv.channel}</span>
                      </div>
                      <p className="text-xs text-muted">{new Date(conv.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {contact.appointments.map((apt) => (
                  <div className="flex items-start gap-3" key={apt.id}>
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                      <CalendarDays size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{apt.title}</p>
                      <p className="text-xs text-muted">{apt.calendar.name} · {new Date(apt.startsAt).toLocaleString()}</p>
                      <Badge variant={statusVariant(apt.status)}>{apt.status}</Badge>
                    </div>
                  </div>
                ))}
                {contact.opportunities.map((opp) => (
                  <div className="flex items-start gap-3" key={opp.id}>
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <Target size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{opp.name}</p>
                      <p className="text-xs text-muted">{opp.stage.pipeline.name} → {opp.stage.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(opp.status)}>{opp.status}</Badge>
                        <span className="text-xs font-semibold">${(opp.valueCents / 100).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {!contact.conversations.length && !contact.appointments.length && !contact.opportunities.length ? (
                  <p className="text-sm text-muted">No activity recorded yet.</p>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Tags */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Tag className="text-primary" size={16} />
                <h2 className="font-semibold">Tags</h2>
              </div>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map(({ tag, tagId }) => (
                  <form action={removeTagFromContact} key={tagId}>
                    <input name="contactId" type="hidden" value={contact!.id} />
                    <input name="tagId" type="hidden" value={tagId} />
                    <button
                      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold text-white transition hover:opacity-80"
                      style={{ backgroundColor: tag.color }}
                      title="Remove tag"
                      type="submit"
                    >
                      {tag.name} ×
                    </button>
                  </form>
                ))}
                {!contact.tags.length ? <p className="text-sm text-muted">No tags assigned.</p> : null}
              </div>
              {availableTags.length > 0 ? (
                <form action={assignTagToContact} className="mt-3 flex gap-2">
                  <input name="contactId" type="hidden" value={contact.id} />
                  <select className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm" name="tagId">
                    {availableTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-md border border-border px-3 py-1.5 text-sm font-medium" type="submit">
                    Add
                  </button>
                </form>
              ) : null}
            </CardBody>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardBody>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Conversations</dt>
                  <dd className="font-semibold">{contact.conversations.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Appointments</dt>
                  <dd className="font-semibold">{contact.appointments.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Opportunities</dt>
                  <dd className="font-semibold">{contact.opportunities.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Pipeline value</dt>
                  <dd className="font-semibold">
                    ${contact.opportunities.reduce((s, o) => s + o.valueCents, 0) / 100 >= 1
                      ? (contact.opportunities.reduce((s, o) => s + o.valueCents, 0) / 100).toLocaleString()
                      : "0"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Source</dt>
                  <dd className="font-semibold">{contact.source ?? "Direct"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Created</dt>
                  <dd className="font-semibold">{new Date(contact.createdAt).toLocaleDateString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Opt-out email</dt>
                  <dd className="font-semibold">{contact.emailOptOut ? "Yes" : "No"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Opt-out SMS</dt>
                  <dd className="font-semibold">{contact.smsOptOut ? "Yes" : "No"}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {/* Danger zone */}
          <Card>
            <CardBody>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Danger zone</p>
              <form action={deleteContact}>
                <input name="contactId" type="hidden" value={contact.id} />
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  type="submit"
                >
                  <Trash2 size={15} />
                  Delete contact
                </button>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
