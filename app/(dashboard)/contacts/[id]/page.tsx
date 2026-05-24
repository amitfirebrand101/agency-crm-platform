import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Mail,
  MessageSquare,
  MessageSquareText,
  Phone,
  Tag,
  Target,
  Trash2
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import {
  assignTagToContact,
  deleteContact,
  removeTagFromContact,
  updateContact
} from "@/app/(dashboard)/contacts/actions";
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

const AVATAR_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#6366f1"];
function avatarBg(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

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
          opportunities: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { stage: { include: { pipeline: true } } }
          }
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
  const fullName = `${contact.firstName} ${contact.lastName ?? ""}`.trim();
  const initial = fullName.charAt(0).toUpperCase();
  const pipelineValue = contact.opportunities.reduce((s, o) => s + o.valueCents, 0) / 100;

  const timelineItems: Array<{
    id: string;
    icon: React.ReactNode;
    iconBg: string;
    title: React.ReactNode;
    sub: React.ReactNode;
    meta: React.ReactNode;
    date: Date;
  }> = [
    ...contact.conversations.map((conv) => ({
      id: conv.id,
      icon: <MessageSquareText size={14} />,
      iconBg: "bg-blue-50 text-blue-600",
      title: (
        <Link className="text-sm font-medium hover:text-primary" href={`/conversations/${conv.id}`}>
          {conv.subject ?? `${conv.channel} conversation`}
        </Link>
      ),
      sub: (
        <span className="text-xs text-muted">{conv.channel}</span>
      ),
      meta: <Badge variant={statusVariant(conv.status)}>{conv.status}</Badge>,
      date: new Date(conv.createdAt)
    })),
    ...contact.appointments.map((apt) => ({
      id: apt.id,
      icon: <CalendarDays size={14} />,
      iconBg: "bg-green-50 text-green-600",
      title: <span className="text-sm font-medium">{apt.title}</span>,
      sub: (
        <span className="text-xs text-muted">
          {apt.calendar.name} · {new Date(apt.startsAt).toLocaleString()}
        </span>
      ),
      meta: <Badge variant={statusVariant(apt.status)}>{apt.status}</Badge>,
      date: new Date(apt.startsAt)
    })),
    ...contact.opportunities.map((opp) => ({
      id: opp.id,
      icon: <Target size={14} />,
      iconBg: "bg-amber-50 text-amber-600",
      title: <span className="text-sm font-medium">{opp.name}</span>,
      sub: (
        <span className="text-xs text-muted">
          {opp.stage.pipeline.name} → {opp.stage.name}
        </span>
      ),
      meta: (
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(opp.status)}>{opp.status}</Badge>
          <span className="text-xs font-semibold">${(opp.valueCents / 100).toLocaleString()}</span>
        </div>
      ),
      date: new Date(opp.createdAt)
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground" href="/contacts">
        <ArrowLeft size={15} />
        Contacts
      </Link>

      {/* Hero card */}
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex size-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ backgroundColor: avatarBg(fullName) }}
              >
                {initial}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{fullName}</h1>
                {contact.companyName ? (
                  <p className="text-sm text-muted">{contact.companyName}</p>
                ) : null}
                <div className="mt-1">
                  <Badge variant={statusVariant(contact.status)}>{contact.status}</Badge>
                </div>
              </div>
            </div>
            {/* Quick action buttons */}
            <div className="flex items-center gap-2">
              {contact.email ? (
                <a
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-background"
                  href={`mailto:${contact.email}`}
                  title={`Email ${fullName}`}
                >
                  <Mail size={15} />
                  Email
                </a>
              ) : null}
              {contact.phone ? (
                <a
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-background"
                  href={`tel:${contact.phone}`}
                  title={`Call ${fullName}`}
                >
                  <Phone size={15} />
                  Call
                </a>
              ) : null}
              {contact.phone ? (
                <a
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-background"
                  href={`tel:${contact.phone}`}
                  title={`SMS ${fullName}`}
                >
                  <MessageSquare size={15} />
                  SMS
                </a>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Main two-column layout */}
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Contact info edit form */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Contact info</h2>
            </CardHeader>
            <CardBody>
              <form action={updateContact} className="space-y-4">
                <input name="contactId" type="hidden" value={contact.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First name" name="firstName" defaultValue={contact.firstName} required />
                  <Field label="Last name" name="lastName" defaultValue={contact.lastName ?? ""} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email" name="email" type="email" defaultValue={contact.email ?? ""} />
                  <Field label="Phone" name="phone" type="tel" defaultValue={contact.phone ?? ""} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Company" name="companyName" defaultValue={contact.companyName ?? ""} />
                  <Field label="Source" name="source" defaultValue={contact.source ?? ""} />
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Status</span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    defaultValue={contact.status}
                    name="status"
                  >
                    <option value="LEAD">Lead</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
                <button
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  type="submit"
                >
                  Save changes
                </button>
              </form>
            </CardBody>
          </Card>

          {/* Activity timeline */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Activity timeline</h2>
            </CardHeader>
            <CardBody>
              {timelineItems.length === 0 ? (
                <p className="text-sm text-muted">No activity recorded yet.</p>
              ) : (
                <div className="relative space-y-0">
                  {/* Vertical connecting line */}
                  <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />
                  {timelineItems.map((item, idx) => (
                    <div className="relative flex items-start gap-4 py-3" key={`${item.id}-${idx}`}>
                      <div
                        className={`relative z-10 mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-panel ${item.iconBg}`}
                      >
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            {item.title}
                            <div>{item.sub}</div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {item.meta}
                            <span className="text-xs text-muted">{item.date.toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right column */}
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
              {contact.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map(({ tag, tagId }) => (
                    <form action={removeTagFromContact} key={tagId}>
                      <input name="contactId" type="hidden" value={contact!.id} />
                      <input name="tagId" type="hidden" value={tagId} />
                      <button
                        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white transition hover:opacity-75"
                        style={{ backgroundColor: tag.color }}
                        title="Remove tag"
                        type="submit"
                      >
                        {tag.name}
                        <span className="text-[10px] leading-none opacity-80">×</span>
                      </button>
                    </form>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">No tags assigned.</p>
              )}
              {availableTags.length > 0 ? (
                <form action={assignTagToContact} className="mt-4 flex gap-2">
                  <input name="contactId" type="hidden" value={contact.id} />
                  <select
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-primary/20 focus:ring-4"
                    name="tagId"
                  >
                    {availableTags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold transition hover:bg-background"
                    type="submit"
                  >
                    Add
                  </button>
                </form>
              ) : null}
            </CardBody>
          </Card>

          {/* Contact stats */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Contact stats</h2>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-border text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Conversations</dt>
                  <dd className="font-semibold">{contact.conversations.length}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Appointments</dt>
                  <dd className="font-semibold">{contact.appointments.length}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Opportunities</dt>
                  <dd className="font-semibold">{contact.opportunities.length}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Pipeline value</dt>
                  <dd className="font-semibold">${pipelineValue.toLocaleString()}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Source</dt>
                  <dd className="font-semibold">{contact.source ?? "Direct"}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Created</dt>
                  <dd className="font-semibold">{new Date(contact.createdAt).toLocaleDateString()}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Opt-out email</dt>
                  <dd className="font-semibold">{contact.emailOptOut ? "Yes" : "No"}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
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
