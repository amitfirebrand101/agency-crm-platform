import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  Mail,
  MapPin,
  MessageSquare,
  MessageSquareText,
  Phone,
  StickyNote,
  Tag,
  Target,
  Trash2,
  User as UserIcon,
  ClipboardList,
  PhoneCall,
  Mic,
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import {
  addContactNote,
  assignTagToContact,
  completeContactTask,
  createContactTask,
  deleteContact,
  deleteContactNote,
  deleteContactTask,
  removeTagFromContact,
  startSmsConversation,
  uncompleteContactTask,
  updateContact,
} from "@/app/(dashboard)/contacts/actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

// ── Prisma payload types ───────────────────────────────────────────────────────

type ContactDetail = Prisma.ContactGetPayload<{
  include: {
    assignedUser: { select: { id: true; name: true; email: true } };
    tags: { include: { tag: true } };
    conversations: {
      where: { channel: { not: "INTERNAL_NOTE" } };
      orderBy: { createdAt: "desc" };
      take: 20;
      include: { messages: { orderBy: { createdAt: "asc" }; take: 1 } };
    };
    appointments: {
      orderBy: { startsAt: "desc" };
      take: 20;
      include: { calendar: true };
    };
    opportunities: {
      orderBy: { createdAt: "desc" };
      take: 20;
      include: { stage: { include: { pipeline: true } } };
    };
    tasks: {
      include: { assignedUser: { select: { id: true; name: true; email: true } } };
      orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }];
    };
  };
}>;

type InternalNote = Prisma.ConversationGetPayload<{
  include: { messages: { orderBy: { createdAt: "asc" } } };
}>;

type SubAccountMember = Prisma.SubAccountMembershipGetPayload<{
  include: { user: { select: { id: true; name: true; email: true } } };
}>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`;
  if (months < 12) return `${months}mo ago`;
  return date.toLocaleDateString();
}

const AVATAR_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#6366f1"];

function avatarBg(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function userInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function channelIcon(channel: string): React.ReactNode {
  switch (channel) {
    case "SMS": return <MessageSquare size={14} />;
    case "EMAIL": return <Mail size={14} />;
    case "CALL": return <PhoneCall size={14} />;
    case "VOICEMAIL": return <Mic size={14} />;
    default: return <MessageSquareText size={14} />;
  }
}

function channelIconBg(channel: string): string {
  switch (channel) {
    case "SMS": return "bg-blue-50 text-blue-600";
    case "EMAIL": return "bg-indigo-50 text-indigo-600";
    case "CALL": return "bg-green-50 text-green-600";
    case "VOICEMAIL": return "bg-purple-50 text-purple-600";
    default: return "bg-slate-50 text-slate-500";
  }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  let contact: ContactDetail | null = null;
  let tags: Awaited<ReturnType<typeof prisma.tag.findMany>> = [];
  let internalNotes: InternalNote[] = [];
  let subAccountMembers: SubAccountMember[] = [];
  let dbError = false;

  try {
    [contact, tags, subAccountMembers] = await Promise.all([
      prisma.contact.findFirst({
        where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        include: {
          assignedUser: { select: { id: true, name: true, email: true } },
          tags: { include: { tag: true } },
          conversations: {
            where: { channel: { not: "INTERNAL_NOTE" } },
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { messages: { orderBy: { createdAt: "asc" }, take: 1 } },
          },
          appointments: {
            orderBy: { startsAt: "desc" },
            take: 20,
            include: { calendar: true },
          },
          opportunities: {
            orderBy: { createdAt: "desc" },
            take: 20,
            include: { stage: { include: { pipeline: true } } },
          },
          tasks: {
            include: { assignedUser: { select: { id: true, name: true, email: true } } },
            orderBy: [{ completedAt: "asc" }, { dueDate: "asc" }],
          },
        },
      }),
      prisma.tag.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { name: "asc" },
      }),
      user.subAccountId
        ? prisma.subAccountMembership.findMany({
            where: { subAccountId: user.subAccountId },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: "asc" },
          })
        : [],
    ]);
  } catch (error) {
    console.error("Contact detail page database query failed", error);
    dbError = true;
  }

  if (contact && !dbError) {
    try {
      internalNotes = await prisma.conversation.findMany({
        where: {
          contactId: contact.id,
          channel: "INTERNAL_NOTE",
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    } catch (error) {
      console.error("Contact detail page notes query failed", error);
    }
  }

  if (dbError) {
    return (
      <div className="space-y-6">
        <Link className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground" href="/contacts">
          <ArrowLeft size={15} />
          Contacts
        </Link>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-semibold text-amber-800">Database temporarily unavailable</p>
          <p className="mt-1 text-sm text-amber-700">Please try refreshing the page in a moment.</p>
        </div>
      </div>
    );
  }

  if (!contact) notFound();

  const assignedTagIds = new Set(contact.tags.map((ct) => ct.tagId));
  const availableTags = tags.filter((t) => !assignedTagIds.has(t.id));
  const fullName = `${contact.firstName} ${contact.lastName ?? ""}`.trim();
  const initial = fullName.charAt(0).toUpperCase();
  const pipelineValue = contact.opportunities.reduce((s, o) => s + o.valueCents, 0) / 100;
  const now = new Date();

  // ── Build timeline items ──────────────────────────────────────────────────

  type TimelineItem = {
    id: string;
    icon: React.ReactNode;
    iconBg: string;
    title: React.ReactNode;
    sub: React.ReactNode;
    meta: React.ReactNode;
    date: Date;
  };

  const timelineItems: TimelineItem[] = [
    // Non-internal conversations (SMS, EMAIL, CALL, VOICEMAIL)
    ...contact.conversations.map((conv) => {
      const preview = conv.messages[0]?.body;
      return {
        id: conv.id,
        icon: channelIcon(conv.channel),
        iconBg: channelIconBg(conv.channel),
        title: (
          <Link
            className="text-sm font-medium hover:text-primary"
            href={`/conversations/${conv.id}`}
          >
            {conv.subject ?? `${conv.channel.charAt(0) + conv.channel.slice(1).toLowerCase()} conversation`}
          </Link>
        ),
        sub: preview ? (
          <span className="text-xs text-muted line-clamp-1">{preview}</span>
        ) : (
          <span className="text-xs text-muted">{conv.channel}</span>
        ),
        meta: <Badge variant={statusVariant(conv.status)}>{conv.status}</Badge>,
        date: new Date(conv.createdAt),
      };
    }),

    // Appointments
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
      date: new Date(apt.startsAt),
    })),

    // Opportunities
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
      date: new Date(opp.createdAt),
    })),

    // Tasks (all of them, complete and incomplete)
    ...contact.tasks.map((task) => {
      const isOverdue =
        task.dueDate && !task.completedAt && new Date(task.dueDate) < now;
      return {
        id: `task-${task.id}`,
        icon: <CheckSquare size={14} />,
        iconBg: task.completedAt
          ? "bg-green-50 text-green-500"
          : isOverdue
          ? "bg-red-50 text-red-500"
          : "bg-slate-50 text-slate-500",
        title: (
          <span
            className={`text-sm font-medium ${task.completedAt ? "text-muted line-through" : ""}`}
          >
            {task.title}
          </span>
        ),
        sub: task.dueDate ? (
          <span className={`text-xs ${isOverdue ? "font-semibold text-red-600" : "text-muted"}`}>
            Due {new Date(task.dueDate).toLocaleDateString()}
            {task.completedAt ? " · Completed" : isOverdue ? " · Overdue" : ""}
          </span>
        ) : task.completedAt ? (
          <span className="text-xs text-muted">Completed {relativeTime(new Date(task.completedAt))}</span>
        ) : (
          <span className="text-xs text-muted">No due date</span>
        ),
        meta: (
          <Badge variant={task.completedAt ? "success" : isOverdue ? "danger" : "muted"}>
            {task.completedAt ? "Done" : isOverdue ? "Overdue" : "Open"}
          </Badge>
        ),
        date: new Date(task.createdAt),
      };
    }),

    // Internal notes
    ...internalNotes.map((note) => {
      const body = note.messages[0]?.body ?? "";
      return {
        id: `note-${note.id}`,
        icon: <StickyNote size={14} />,
        iconBg: "bg-amber-50 text-amber-500",
        title: <span className="text-sm font-medium text-amber-900">Internal note</span>,
        sub: (
          <span className="text-xs text-muted line-clamp-2 max-w-sm">{body}</span>
        ),
        meta: <Badge variant="warning">Note</Badge>,
        date: new Date(note.createdAt),
      };
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        href="/contacts"
      >
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
                {contact.assignedUser ? (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{
                        backgroundColor: avatarBg(
                          contact.assignedUser.name ?? contact.assignedUser.email
                        ),
                      }}
                    >
                      {userInitials(contact.assignedUser.name, contact.assignedUser.email)}
                    </span>
                    <span className="text-xs text-muted">
                      Assigned to{" "}
                      <span className="font-medium text-foreground">
                        {contact.assignedUser.name ?? contact.assignedUser.email}
                      </span>
                    </span>
                  </div>
                ) : null}
                <div className="mt-1">
                  <Badge variant={statusVariant(contact.status)}>{contact.status}</Badge>
                </div>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap items-center gap-2">
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
                <form action={startSmsConversation}>
                  <input name="contactId" type="hidden" value={contact.id} />
                  <SubmitButton
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-background"
                    title={`SMS ${fullName}`}
                    pendingText="Opening…"
                  >
                    <MessageSquare size={15} />
                    SMS
                  </SubmitButton>
                </form>
              ) : null}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Main two-column layout */}
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* ── Left column ── */}
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
                  <Field
                    label="First name"
                    name="firstName"
                    defaultValue={contact.firstName}
                    required
                  />
                  <Field
                    label="Last name"
                    name="lastName"
                    defaultValue={contact.lastName ?? ""}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    defaultValue={contact.email ?? ""}
                  />
                  <Field
                    label="Phone"
                    name="phone"
                    type="tel"
                    defaultValue={contact.phone ?? ""}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Company"
                    name="companyName"
                    defaultValue={contact.companyName ?? ""}
                  />
                  <Field
                    label="Source"
                    name="source"
                    defaultValue={contact.source ?? ""}
                  />
                </div>

                {/* Status */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Status
                  </span>
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

                {/* Assigned user */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Assigned to
                  </span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    defaultValue={contact.assignedUserId ?? ""}
                    name="assignedUserId"
                  >
                    <option value="">(Unassigned)</option>
                    {subAccountMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user.name ?? m.user.email}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Marketing opt-outs */}
                <div className="space-y-2 rounded-md border border-border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Marketing preferences
                  </p>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      className="size-4 rounded border-border accent-primary"
                      defaultChecked={contact.emailOptOut}
                      name="emailOptOut"
                      type="checkbox"
                    />
                    <span className="text-sm">Opt out of email marketing</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      className="size-4 rounded border-border accent-primary"
                      defaultChecked={contact.smsOptOut}
                      name="smsOptOut"
                      type="checkbox"
                    />
                    <span className="text-sm">Opt out of SMS marketing</span>
                  </label>
                </div>

                <SubmitButton
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  pendingText="Saving…"
                >
                  Save changes
                </SubmitButton>
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
                  <div className="absolute bottom-4 left-[19px] top-4 w-px bg-border" />
                  {timelineItems.map((item, idx) => (
                    <div
                      className="relative flex items-start gap-4 py-3"
                      key={`${item.id}-${idx}`}
                    >
                      <div
                        className={`relative z-10 mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-panel ${item.iconBg}`}
                      >
                        {item.icon}
                      </div>
                      <div className="min-w-0 flex-1 pt-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 space-y-0.5">
                            {item.title}
                            <div>{item.sub}</div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {item.meta}
                            <time
                              className="text-xs text-muted"
                              dateTime={item.date.toISOString()}
                              title={item.date.toLocaleString()}
                            >
                              {relativeTime(item.date)}
                            </time>
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

        {/* ── Right column ── */}
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
                      <SubmitButton
                        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white transition hover:opacity-75"
                        style={{ backgroundColor: tag.color }}
                        title="Remove tag"
                        pendingText="Removing…"
                      >
                        {tag.name}
                        <span className="text-[10px] leading-none opacity-80">×</span>
                      </SubmitButton>
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
                  <SubmitButton
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold transition hover:bg-background"
                    pendingText="Adding…"
                  >
                    Add
                  </SubmitButton>
                </form>
              ) : null}
            </CardBody>
          </Card>

          {/* Internal notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <StickyNote className="text-amber-500" size={16} />
                <h2 className="font-semibold">Notes</h2>
              </div>
            </CardHeader>
            <CardBody>
              {/* Existing notes */}
              {internalNotes.length === 0 ? (
                <p className="mb-4 text-sm text-muted">No notes yet. Add one below.</p>
              ) : (
                <div className="mb-4 max-h-96 space-y-2 overflow-y-auto pr-1">
                  {internalNotes.map((note) => {
                    const body = note.messages[0]?.body ?? "";
                    const date = new Date(note.createdAt);
                    return (
                      <div
                        className="group relative rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm"
                        key={note.id}
                      >
                        <p className="whitespace-pre-wrap text-amber-900">{body}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <time
                            className="text-xs text-amber-600/70"
                            dateTime={date.toISOString()}
                            title={date.toLocaleString()}
                          >
                            {relativeTime(date)}
                          </time>
                          {/* Delete note button */}
                          <form action={deleteContactNote}>
                            <input name="conversationId" type="hidden" value={note.id} />
                            <input name="contactId" type="hidden" value={contact!.id} />
                            <SubmitButton
                              className="rounded p-1 text-amber-400 opacity-0 transition hover:bg-amber-100 hover:text-red-600 group-hover:opacity-100"
                              title="Delete note"
                              pendingText="…"
                            >
                              <span aria-hidden="true" className="text-xs leading-none">
                                ✕
                              </span>
                            </SubmitButton>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add note form */}
              <form action={addContactNote} className="space-y-2">
                <input name="contactId" type="hidden" value={contact.id} />
                <label className="block">
                  <span className="sr-only">Note text</span>
                  <textarea
                    aria-label="Note text"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    maxLength={2000}
                    name="body"
                    placeholder="Add an internal note… (max 2000 chars)"
                    required
                    rows={3}
                  />
                </label>
                <SubmitButton
                  className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                  pendingText="Saving…"
                >
                  Add note
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardList className="text-primary" size={16} />
                <h2 className="font-semibold">Tasks</h2>
                {contact.tasks.length > 0 ? (
                  <span className="ml-auto text-xs text-muted">
                    {contact.tasks.filter((t) => !t.completedAt).length} open
                  </span>
                ) : null}
              </div>
            </CardHeader>
            <CardBody>
              {/* Task list */}
              {contact.tasks.length === 0 ? (
                <p className="mb-4 text-sm text-muted">No tasks yet.</p>
              ) : (
                <ul className="mb-4 space-y-2">
                  {contact.tasks.map((task) => {
                    const isOverdue =
                      task.dueDate && !task.completedAt && new Date(task.dueDate) < now;
                    const assigneeName =
                      task.assignedUser?.name ?? task.assignedUser?.email ?? null;

                    return (
                      <li
                        className={`group flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                          task.completedAt
                            ? "border-border bg-background opacity-60"
                            : isOverdue
                            ? "border-red-200 bg-red-50"
                            : "border-border bg-background"
                        }`}
                        key={task.id}
                      >
                        {/* Complete / uncomplete toggle */}
                        <form
                          action={task.completedAt ? uncompleteContactTask : completeContactTask}
                          className="mt-0.5 shrink-0"
                        >
                          <input name="taskId" type="hidden" value={task.id} />
                          <input name="contactId" type="hidden" value={contact!.id} />
                          <button
                            className={`flex size-4 items-center justify-center rounded border transition ${
                              task.completedAt
                                ? "border-green-400 bg-green-100 text-green-600 hover:bg-green-200"
                                : "border-border bg-background hover:border-primary"
                            }`}
                            title={task.completedAt ? "Mark incomplete" : "Mark complete"}
                            type="submit"
                          >
                            {task.completedAt ? (
                              <span className="text-[10px] leading-none">✓</span>
                            ) : null}
                          </button>
                        </form>

                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-medium leading-snug ${
                              task.completedAt ? "text-muted line-through" : ""
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            {task.dueDate ? (
                              <span
                                className={`text-xs ${
                                  isOverdue
                                    ? "font-semibold text-red-600"
                                    : task.completedAt
                                    ? "text-muted"
                                    : "text-muted"
                                }`}
                              >
                                Due {new Date(task.dueDate).toLocaleDateString()}
                                {isOverdue ? " · Overdue" : ""}
                              </span>
                            ) : null}
                            {assigneeName ? (
                              <div className="flex items-center gap-1">
                                <span
                                  className="flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                  style={{
                                    backgroundColor: avatarBg(
                                      task.assignedUser?.name ?? task.assignedUser?.email ?? "?"
                                    ),
                                  }}
                                  title={assigneeName}
                                >
                                  {userInitials(
                                    task.assignedUser?.name ?? null,
                                    task.assignedUser?.email ?? "?"
                                  )}
                                </span>
                                <span className="text-xs text-muted">{assigneeName}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Delete task */}
                        <form action={deleteContactTask} className="shrink-0">
                          <input name="taskId" type="hidden" value={task.id} />
                          <input name="contactId" type="hidden" value={contact!.id} />
                          <SubmitButton
                            className="rounded p-1 text-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                            title="Delete task"
                            pendingText="…"
                          >
                            <span aria-hidden="true" className="text-xs leading-none">
                              ✕
                            </span>
                          </SubmitButton>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Add task form */}
              <form action={createContactTask} className="space-y-2.5">
                <input name="contactId" type="hidden" value={contact.id} />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Add task
                </p>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                  maxLength={200}
                  name="title"
                  placeholder="Task title…"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Due date</span>
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                      name="dueDate"
                      type="date"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted">Assign to</span>
                    <select
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                      defaultValue=""
                      name="assignedUserId"
                    >
                      <option value="">(Unassigned)</option>
                      {subAccountMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.user.name ?? m.user.email}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <SubmitButton
                  className="w-full rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
                  pendingText="Adding…"
                >
                  Add task
                </SubmitButton>
              </form>
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
                  <dt className="text-muted">Tasks</dt>
                  <dd className="font-semibold">
                    {contact.tasks.filter((t) => !t.completedAt).length} open /{" "}
                    {contact.tasks.length} total
                  </dd>
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
                  <dd className="font-semibold">
                    {new Date(contact.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="flex items-center gap-1 text-muted">
                    <Mail size={12} className="shrink-0" />
                    Email opt-out
                  </dt>
                  <dd>
                    {contact.emailOptOut ? (
                      <Badge variant="danger">Yes</Badge>
                    ) : (
                      <Badge variant="muted">No</Badge>
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="flex items-center gap-1 text-muted">
                    <MessageSquare size={12} className="shrink-0" />
                    SMS opt-out
                  </dt>
                  <dd>
                    {contact.smsOptOut ? (
                      <Badge variant="danger">Yes</Badge>
                    ) : (
                      <Badge variant="muted">No</Badge>
                    )}
                  </dd>
                </div>
                {contact.assignedUser ? (
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="flex items-center gap-1 text-muted">
                      <UserIcon size={12} className="shrink-0" />
                      Assigned to
                    </dt>
                    <dd className="font-semibold">
                      {contact.assignedUser.name ?? contact.assignedUser.email}
                    </dd>
                  </div>
                ) : null}
                {contact.addressLine1 ??
                contact.city ??
                contact.region ??
                contact.country ??
                contact.postalCode ? (
                  <div className="py-2.5">
                    <dt className="mb-1 flex items-center gap-1.5 text-muted">
                      <MapPin size={12} className="shrink-0" />
                      Address
                    </dt>
                    <dd className="font-semibold leading-snug">
                      {[
                        contact.addressLine1,
                        [contact.city, contact.region].filter(Boolean).join(", "),
                        [contact.postalCode, contact.country].filter(Boolean).join(" "),
                      ]
                        .filter(Boolean)
                        .map((line, i) => (
                          <span className="block" key={i}>
                            {line}
                          </span>
                        ))}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {/* Danger zone */}
          <Card>
            <CardBody>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Danger zone
              </p>
              <form action={deleteContact}>
                <input name="contactId" type="hidden" value={contact.id} />
                <SubmitButton
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  pendingText="Deleting…"
                >
                  <Trash2 size={15} />
                  Delete contact
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
