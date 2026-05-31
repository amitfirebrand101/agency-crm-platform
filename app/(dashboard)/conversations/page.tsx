import Link from "next/link";
import { Plus, MessageSquareText, Phone, Mail, MessageSquare, Voicemail, StickyNote, ChevronLeft, ChevronRight, MessageSquareQuote, UserCheck } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { sendMessage, updateConversationStatus } from "@/app/(dashboard)/conversations/[id]/actions";
import { createConversation } from "@/app/(dashboard)/module-actions";
import { markConversationUnread, setConversationPriority, addConversationLabel, removeConversationLabel, assignConversation } from "./conversation-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ConversationClient, PrioritySelector } from "./conversation-client";

export const dynamic = "force-dynamic";

// ── Constants ─────────────────────────────────────────────────────────────────

const CONV_PAGE_SIZE = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

type ConversationWithContact = Prisma.ConversationGetPayload<{
  include: {
    contact: { select: { id: true; firstName: true; lastName: true; email: true; phone: true } };
    messages: { orderBy: { createdAt: "desc" }; take: 1; select: { id: true; body: true; direction: true; createdAt: true } };
    assignedUser: { select: { id: true; name: true; email: true } };
  };
}>;

type ConversationDetail = Prisma.ConversationGetPayload<{
  include: {
    contact: true;
    messages: {
      orderBy: { createdAt: "asc" };
      select: {
        id: true;
        body: true;
        direction: true;
        status: true;
        createdAt: true;
      };
    };
    assignedUser: { select: { id: true; name: true; email: true } };
  };
}>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#6366f1"];
function avatarBg(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString();
}

const CHANNEL_LABELS: Record<string, string> = {
  SMS: "SMS",
  EMAIL: "Email",
  CALL: "Call",
  VOICEMAIL: "Voicemail",
  INTERNAL_NOTE: "Note",
};

function ChannelIcon({ channel, size = 12 }: { channel: string; size?: number }) {
  const cls = `shrink-0 text-muted`;
  if (channel === "SMS") return <MessageSquare size={size} className={cls} />;
  if (channel === "EMAIL") return <Mail size={size} className={cls} />;
  if (channel === "CALL") return <Phone size={size} className={cls} />;
  if (channel === "VOICEMAIL") return <Voicemail size={size} className={cls} />;
  if (channel === "INTERNAL_NOTE") return <StickyNote size={size} className={cls} />;
  return <MessageSquareText size={size} className={cls} />;
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "OPEN" ? "bg-green-500" : status === "PENDING" ? "bg-amber-400" : "bg-gray-300";
  return <span className={`inline-block size-2 rounded-full ${color}`} />;
}

function PriorityDot({ priority }: { priority: string }) {
  if (priority === "urgent") return <span className="inline-block size-2 rounded-full bg-red-500" title="Urgent" />;
  if (priority === "high") return <span className="inline-block size-2 rounded-full bg-amber-400" title="High" />;
  return null;
}

function contactName(conv: ConversationWithContact | ConversationDetail): string {
  if (conv.contact) {
    return `${conv.contact.firstName} ${conv.contact.lastName ?? ""}`.trim();
  }
  return CHANNEL_LABELS[conv.channel] ?? conv.channel;
}

function contactInitials(conv: ConversationWithContact | ConversationDetail): string {
  const name = contactName(conv);
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string; channel?: string; status?: string; q?: string; cpage?: string; mine?: string }>;
}) {
  const params = await searchParams;
  const activeId = params?.id ?? null;
  const channelFilter = params?.channel ?? "";
  const statusFilter = params?.status ?? "";
  const q = params?.q ?? "";
  const cpage = Math.max(1, parseInt(params?.cpage ?? "1", 10) || 1);
  const mineOnly = params?.mine === "1";

  const user = await requireUser();
  let databaseUnavailable = false;
  let conversations: ConversationWithContact[] = [];
  let totalConversations = 0;
  let unreadCount = 0;
  let active: ConversationDetail | null = null;
  let subAccountMembers: Array<{ userId: string; user: { id: string; name: string | null; email: string } }> = [];
  let cannedResponses: Array<{ id: string; name: string; body: string }> = [];
  let contactsForPicker: Array<{ id: string; firstName: string; lastName: string | null; phone: string | null; email: string | null }> = [];

  try {
    const where: Prisma.ConversationWhereInput = {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined,
      ...(channelFilter ? { channel: channelFilter as Prisma.EnumConversationChannelFilter } : {}),
      ...(statusFilter ? { status: statusFilter as Prisma.EnumConversationStatusFilter } : {}),
      ...(mineOnly && user.id ? { assignedUserId: user.id } : {}),
    };

    const skip = (cpage - 1) * CONV_PAGE_SIZE;

    const [fetched, count, unread, members, canned, contacts] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: CONV_PAGE_SIZE + 1,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, body: true, direction: true, createdAt: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.conversation.count({ where }),
      prisma.conversation.count({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined, unread: true },
      }),
      user.subAccountId
        ? prisma.subAccountMembership.findMany({
            where: { subAccountId: user.subAccountId },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { user: { name: "asc" } },
          })
        : Promise.resolve([]),
      user.subAccountId
        ? prisma.cannedResponse.findMany({
            where: { agencyId: user.agencyId, subAccountId: user.subAccountId },
            orderBy: { name: "asc" },
            select: { id: true, name: true, body: true },
          })
        : Promise.resolve([]),
      prisma.contact.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { firstName: "asc" },
        take: 200,
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      }),
    ]);

    totalConversations = count;
    conversations = fetched;
    unreadCount = unread;
    subAccountMembers = members;
    cannedResponses = canned;
    contactsForPicker = contacts;

    if (activeId) {
      active = await prisma.conversation.findFirst({
        where: {
          id: activeId,
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
        },
        include: {
          contact: true,
          messages: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                body: true,
                direction: true,
                status: true,
                createdAt: true,
              },
            },
          assignedUser: { select: { id: true, name: true, email: true } },
        },
      });

      // Mark conversation as read when opened
      if (active?.unread) {
        await prisma.conversation.update({
          where: { id: activeId },
          data: { unread: false },
        });
        if (active) active = { ...active, unread: false };
      }
    }
  } catch (error) {
    databaseUnavailable = true;
    console.error("Conversations page database query failed", error);
  }

  // Pagination state
  const hasMoreConvs = conversations.length > CONV_PAGE_SIZE;
  const pageConversations = hasMoreConvs ? conversations.slice(0, CONV_PAGE_SIZE) : conversations;
  const totalPages = Math.max(1, Math.ceil(totalConversations / CONV_PAGE_SIZE));

  const filtered =
    q.trim()
      ? pageConversations.filter((c) => {
          const name = contactName(c).toLowerCase();
          const preview = c.messages[0]?.body.toLowerCase() ?? "";
          const sq = q.toLowerCase();
          return name.includes(sq) || preview.includes(sq);
        })
      : pageConversations;

  function filterHref(overrides: Record<string, string>) {
    const merged: Record<string, string> = {
      ...(channelFilter ? { channel: channelFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(activeId ? { id: activeId } : {}),
      ...(q ? { q } : {}),
      ...(cpage > 1 ? { cpage: String(cpage) } : {}),
      ...(mineOnly ? { mine: "1" } : {}),
      ...overrides,
    };
    const qs = Object.entries(merged)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `/conversations${qs ? `?${qs}` : ""}`;
  }

  function convPageHref(targetPage: number): string {
    const sp = new URLSearchParams();
    if (channelFilter) sp.set("channel", channelFilter);
    if (statusFilter) sp.set("status", statusFilter);
    if (activeId) sp.set("id", activeId);
    if (q) sp.set("q", q);
    if (mineOnly) sp.set("mine", "1");
    if (targetPage > 1) sp.set("cpage", String(targetPage));
    const qs = sp.toString();
    return `/conversations${qs ? `?${qs}` : ""}`;
  }

  const CHANNEL_FILTERS = [
    { label: "All", value: "" },
    { label: "SMS", value: "SMS" },
    { label: "Email", value: "EMAIL" },
    { label: "Call", value: "CALL" },
  ];

  const rangeStart = totalConversations === 0 ? 0 : (cpage - 1) * CONV_PAGE_SIZE + 1;
  const rangeEnd = Math.min(cpage * CONV_PAGE_SIZE, totalConversations);

  return (
    <div className="-mx-5 -my-6 lg:-mx-8 flex" style={{ height: "calc(100vh - 61px)" }}>
      {databaseUnavailable && (
        <div className="absolute inset-x-0 top-0 z-20 px-4 pt-2">
          <DbWarning />
        </div>
      )}

      {/* ── Left panel ────────────────────────────────────────── */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border bg-panel">
        {/* Panel header */}
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Inbox</h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {totalConversations}
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <details className="relative">
              <summary className="flex size-7 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-background text-muted hover:text-foreground">
                <Plus size={14} />
              </summary>
              <div className="absolute right-0 top-8 z-30 w-72 rounded-lg border border-border bg-panel p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">New conversation</p>
                <form action={createConversation} className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Contact</span>
                    <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" name="contactId">
                      <option value="">— No contact —</option>
                      {contactsForPicker.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName ?? ""}{c.phone ? ` · ${c.phone}` : c.email ? ` · ${c.email}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Channel</span>
                    <select className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" defaultValue="SMS" name="channel">
                      <option value="SMS">SMS</option>
                      <option value="EMAIL">Email</option>
                      <option value="CALL">Call</option>
                      <option value="VOICEMAIL">Voicemail</option>
                      <option value="INTERNAL_NOTE">Internal note</option>
                    </select>
                  </label>
                  <Field label="Subject (optional)" name="subject" placeholder="Follow-up" />
                  <SubmitButton className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white" pendingText="Creating…">
                    Start conversation
                  </SubmitButton>
                </form>
              </div>
            </details>
          </div>

          {/* Channel filter pills */}
          <div className="mt-2 flex gap-1.5 flex-wrap">
            {CHANNEL_FILTERS.map(({ label, value }) => {
              const active_ = channelFilter === value;
              return (
                <a
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                    active_ ? "bg-primary text-white" : "bg-background text-muted hover:text-foreground border border-border"
                  }`}
                  href={filterHref({ channel: value, cpage: "1" })}
                  key={value || "all"}
                >
                  {label}
                </a>
              );
            })}
            <a
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                mineOnly ? "bg-primary text-white" : "bg-background text-muted hover:text-foreground border border-border"
              }`}
              href={mineOnly ? filterHref({ mine: "" }) : filterHref({ mine: "1" })}
            >
              Mine
            </a>
            <Link
              href="/conversations/canned-responses"
              className="flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted transition hover:text-foreground"
            >
              <MessageSquareQuote size={10} />
              Templates
            </Link>
          </div>

          {/* Search */}
          <form className="mt-2" method="GET">
            {channelFilter && <input name="channel" type="hidden" value={channelFilter} />}
            {statusFilter && <input name="status" type="hidden" value={statusFilter} />}
            {activeId && <input name="id" type="hidden" value={activeId} />}
            {mineOnly && <input name="mine" type="hidden" value="1" />}
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none ring-primary/20 focus:ring-2"
              defaultValue={q}
              name="q"
              placeholder="Search conversations…"
              type="search"
            />
          </form>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No conversations found.</p>
          ) : (
            filtered.map((conv) => {
              const name = contactName(conv);
              const initials = contactInitials(conv);
              const lastMsg = conv.messages[0];
              const preview = lastMsg?.body ?? conv.subject ?? "";
              const time = relTime(new Date(conv.updatedAt));
              const isActive = activeId === conv.id;

              const href = filterHref({ id: conv.id });

              return (
                <a
                  className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-background ${
                    isActive ? "border-l-2 border-l-primary bg-primary/5" : ""
                  } ${conv.unread ? "bg-blue-50/30" : ""}`}
                  href={href}
                  key={conv.id}
                >
                  {/* Avatar */}
                  <div
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: avatarBg(name) }}
                  >
                    {initials}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`truncate text-sm ${conv.unread ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}
                      >
                        {name}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <PriorityDot priority={conv.priority} />
                        <ChannelIcon channel={conv.channel} size={11} />
                        <span className="text-xs text-muted">{time}</span>
                        {conv.unread && <span className="size-2 rounded-full bg-blue-500 shrink-0" />}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs text-muted">
                        {preview ? preview.slice(0, 55) : "No messages yet"}
                      </span>
                      <StatusDot status={conv.status} />
                    </div>
                    {conv.labels.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {conv.labels.slice(0, 3).map((label) => (
                          <span
                            key={label}
                            className="rounded px-1 py-0.5 text-[10px] font-medium bg-primary/10 text-primary"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    {conv.assignedUser && (
                      <p className="mt-0.5 text-[10px] text-muted truncate">
                        → {conv.assignedUser.name ?? conv.assignedUser.email}
                      </p>
                    )}
                  </div>
                </a>
              );
            })
          )}
        </div>

        {/* Conversation list pagination */}
        {totalPages > 1 && (
          <div className="shrink-0 border-t border-border">
            {totalConversations > 0 && (
              <p className="pt-2 text-center text-[10px] text-muted">
                {rangeStart}–{rangeEnd} of {totalConversations}
              </p>
            )}
            <nav aria-label="Conversations pagination" className="flex items-center justify-between px-3 py-2">
              {cpage > 1 ? (
                <a href={convPageHref(cpage - 1)} aria-label="Previous conversations page" className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium transition hover:bg-panel">
                  <ChevronLeft size={12} aria-hidden="true" />Prev
                </a>
              ) : (
                <span className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted opacity-40 cursor-not-allowed select-none">
                  <ChevronLeft size={12} aria-hidden="true" />Prev
                </span>
              )}
              <span className="text-[10px] text-muted">{cpage} / {totalPages}</span>
              {cpage < totalPages ? (
                <a href={convPageHref(cpage + 1)} aria-label="Next conversations page" className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium transition hover:bg-panel">
                  Next<ChevronRight size={12} aria-hidden="true" />
                </a>
              ) : (
                <span className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted opacity-40 cursor-not-allowed select-none">
                  Next<ChevronRight size={12} aria-hidden="true" />
                </span>
              )}
            </nav>
          </div>
        )}
      </div>

      {/* ── Right panel ───────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {active == null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <MessageSquareText className="text-muted/40" size={48} />
            <p className="text-sm text-muted">Select a conversation from the list</p>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div className="shrink-0 border-b border-border bg-panel px-5 py-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: avatarBg(contactName(active)) }}
                  >
                    {contactInitials(active)}
                  </div>
                  <div>
                    <p className="font-semibold leading-tight">{contactName(active)}</p>
                    {active.contact ? (
                      <p className="text-xs text-muted">{active.contact.email ?? active.contact.phone ?? ""}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Badge variant={statusVariant(active.status)}>{active.status}</Badge>
                  <Badge variant="muted">{CHANNEL_LABELS[active.channel] ?? active.channel}</Badge>

                  {/* Priority selector */}
                  <PrioritySelector
                    action={setConversationPriority}
                    conversationId={active.id}
                    priority={active.priority}
                  />

                  {/* Assign to */}
                  <form action={assignConversation} className="flex items-center gap-1">
                    <input name="conversationId" type="hidden" value={active.id} />
                    <select
                      name="assignedUserId"
                      defaultValue={active.assignedUserId ?? ""}
                      className="rounded px-2 py-1 text-xs border border-border bg-background text-muted"
                    >
                      <option value="">Unassigned</option>
                      {subAccountMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.user.name ?? m.user.email}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className="rounded px-2 py-1 text-xs border border-border bg-background text-muted hover:text-foreground transition" pendingText="…">
                      <UserCheck size={12} />
                    </SubmitButton>
                  </form>

                  {/* Status update buttons */}
                  {(["OPEN", "PENDING", "CLOSED"] as const).map((s) => (
                    <form action={updateConversationStatus} key={s}>
                      <input name="conversationId" type="hidden" value={active!.id} />
                      <input name="status" type="hidden" value={s} />
                      <SubmitButton
                        className={`rounded px-2 py-1 text-xs font-semibold transition ${
                          active!.status === s ? "bg-primary/10 text-primary" : "border border-border text-muted hover:text-foreground"
                        }`}
                        pendingText="Saving…"
                      >
                        {s === "OPEN" ? "Open" : s === "PENDING" ? "Pending" : "Closed"}
                      </SubmitButton>
                    </form>
                  ))}

                  {/* Mark as unread */}
                  <form action={markConversationUnread}>
                    <input name="conversationId" type="hidden" value={active.id} />
                    <SubmitButton className="rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground transition" pendingText="…" title="Mark as unread">
                      Mark unread
                    </SubmitButton>
                  </form>
                </div>
              </div>

              {/* Labels */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {active.labels.map((label) => (
                  <form action={removeConversationLabel} key={label} className="flex items-center">
                    <input name="conversationId" type="hidden" value={active!.id} />
                    <input name="label" type="hidden" value={label} />
                    <button
                      type="submit"
                      className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-red-100 hover:text-red-600 transition"
                    >
                      {label} ×
                    </button>
                  </form>
                ))}
                <form action={addConversationLabel} className="flex items-center gap-1">
                  <input name="conversationId" type="hidden" value={active.id} />
                  <input
                    name="label"
                    placeholder="+ Add label"
                    className="rounded border border-dashed border-border bg-transparent px-2 py-0.5 text-xs outline-none focus:border-primary w-24"
                    maxLength={50}
                  />
                  <button type="submit" className="sr-only">Add</button>
                </form>
              </div>
            </div>

            {/* Pass to client component for search + export + canned responses */}
            <ConversationClient
              conversation={{
                id: active.id,
                messages: active.messages.map((m) => ({
                  id: m.id,
                  body: m.body,
                  direction: m.direction,
                  status: m.status,
                  error: null, // populated after add-message-error.sql migration runs
                  createdAt: m.createdAt.toISOString(),
                })),
              }}
              cannedResponses={cannedResponses}
              sendMessageAction={sendMessage}
            />
          </>
        )}
      </div>
    </div>
  );
}
