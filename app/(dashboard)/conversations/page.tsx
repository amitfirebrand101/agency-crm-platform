import { Plus, MessageSquareText, Phone, Mail, MessageSquare, Voicemail, StickyNote, Send } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { sendMessage, updateConversationStatus } from "@/app/(dashboard)/conversations/[id]/actions";
import { createConversation } from "@/app/(dashboard)/module-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Types ─────────────────────────────────────────────────────────────────────

type ConversationWithContact = Prisma.ConversationGetPayload<{
  include: { contact: true; messages: { orderBy: { createdAt: "desc" }; take: 1 } };
}>;

type ConversationDetail = Prisma.ConversationGetPayload<{
  include: { contact: true; messages: { orderBy: { createdAt: "asc" } } };
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
  searchParams?: Promise<{ id?: string; channel?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const activeId = params?.id ?? null;
  const channelFilter = params?.channel ?? "";
  const statusFilter = params?.status ?? "";
  const q = params?.q ?? "";

  const user = await requireUser();
  let databaseUnavailable = false;
  let conversations: ConversationWithContact[] = [];
  let active: ConversationDetail | null = null;

  try {
    const where: Prisma.ConversationWhereInput = {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined,
      ...(channelFilter ? { channel: channelFilter as Prisma.EnumConversationChannelFilter } : {}),
      ...(statusFilter ? { status: statusFilter as Prisma.EnumConversationStatusFilter } : {}),
    };

    conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { contact: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (activeId) {
      active = await prisma.conversation.findFirst({
        where: {
          id: activeId,
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
        },
        include: { contact: true, messages: { orderBy: { createdAt: "asc" } } },
      });
    }
  } catch (error) {
    databaseUnavailable = true;
    console.error("Conversations page database query failed", error);
  }

  // Client-side q filter (simple substring match on name + last message)
  const filtered =
    q.trim()
      ? conversations.filter((c) => {
          const name = contactName(c).toLowerCase();
          const preview = c.messages[0]?.body.toLowerCase() ?? "";
          const sq = q.toLowerCase();
          return name.includes(sq) || preview.includes(sq);
        })
      : conversations;

  // Build filter link helper
  function filterHref(overrides: Record<string, string>) {
    const merged: Record<string, string> = {
      ...(channelFilter ? { channel: channelFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(activeId ? { id: activeId } : {}),
      ...(q ? { q } : {}),
      ...overrides,
    };
    const qs = Object.entries(merged)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `/conversations${qs ? `?${qs}` : ""}`;
  }

  const CHANNEL_FILTERS = [
    { label: "All", value: "" },
    { label: "SMS", value: "SMS" },
    { label: "Email", value: "EMAIL" },
    { label: "Call", value: "CALL" },
  ];

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
                {conversations.length}
              </span>
            </div>
            {/* New conversation — reuse existing form in a popover-less inline approach */}
            <details className="relative">
              <summary className="flex size-7 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-background text-muted hover:text-foreground">
                <Plus size={14} />
              </summary>
              <div className="absolute right-0 top-8 z-30 w-64 rounded-lg border border-border bg-panel p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">New thread</p>
                <form action={createConversation} className="space-y-2">
                  <Field label="Subject" name="subject" placeholder="New lead follow-up" />
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Channel
                    </span>
                    <select
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                      defaultValue="SMS"
                      name="channel"
                    >
                      <option value="SMS">SMS</option>
                      <option value="EMAIL">Email</option>
                      <option value="CALL">Call</option>
                      <option value="VOICEMAIL">Voicemail</option>
                      <option value="INTERNAL_NOTE">Internal note</option>
                    </select>
                  </label>
                  <button
                    className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white"
                    type="submit"
                  >
                    Create thread
                  </button>
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
                    active_
                      ? "bg-primary text-white"
                      : "bg-background text-muted hover:text-foreground border border-border"
                  }`}
                  href={filterHref({ channel: value })}
                  key={value || "all"}
                >
                  {label}
                </a>
              );
            })}
          </div>

          {/* Search */}
          <form className="mt-2" method="GET">
            {channelFilter && <input name="channel" type="hidden" value={channelFilter} />}
            {statusFilter && <input name="status" type="hidden" value={statusFilter} />}
            {activeId && <input name="id" type="hidden" value={activeId} />}
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
              const isUnread = conv.status === "OPEN" && !!lastMsg;

              const href = filterHref({ id: conv.id });

              return (
                <a
                  className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-background ${
                    isActive ? "border-l-2 border-l-primary bg-primary/5" : ""
                  }`}
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
                        className={`truncate text-sm ${isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80"}`}
                      >
                        {name}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <ChannelIcon channel={conv.channel} size={11} />
                        <span className="text-xs text-muted">{time}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs text-muted">
                        {preview ? preview.slice(0, 55) : "No messages yet"}
                      </span>
                      <StatusDot status={conv.status} />
                    </div>
                  </div>
                </a>
              );
            })
          )}
        </div>
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
              <div className="flex items-center justify-between gap-4">
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
                      <p className="text-xs text-muted">
                        {active.contact.email ?? active.contact.phone ?? ""}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Badge variant={statusVariant(active.status)}>{active.status}</Badge>
                  <Badge variant="muted">{CHANNEL_LABELS[active.channel] ?? active.channel}</Badge>

                  {/* Status update buttons */}
                  {(["OPEN", "PENDING", "CLOSED"] as const).map((s) => (
                    <form action={updateConversationStatus} key={s}>
                      <input name="conversationId" type="hidden" value={active!.id} />
                      <input name="status" type="hidden" value={s} />
                      <button
                        className={`rounded px-2 py-1 text-xs font-semibold transition ${
                          active!.status === s
                            ? "bg-primary/10 text-primary"
                            : "border border-border text-muted hover:text-foreground"
                        }`}
                        type="submit"
                      >
                        {s === "OPEN" ? "Open" : s === "PENDING" ? "Pending" : "Closed"}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            </div>

            {/* Message thread */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {active.messages.length === 0 ? (
                <p className="text-center text-sm text-muted py-10">No messages yet.</p>
              ) : (
                active.messages.map((msg) => {
                  const isOutbound = msg.direction === "outbound";
                  const isInternal = msg.direction === "internal";

                  if (isInternal) {
                    return (
                      <div className="flex justify-center" key={msg.id}>
                        <div className="max-w-[70%] rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
                          <p className="italic">{msg.body}</p>
                          <p className="mt-1 text-xs opacity-60">
                            {new Date(msg.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                      key={msg.id}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${
                          isOutbound
                            ? "bg-primary text-white"
                            : "border border-border bg-background text-foreground"
                        }`}
                      >
                        <p>{msg.body}</p>
                        <p className={`mt-1 text-xs ${isOutbound ? "opacity-70" : "text-muted"}`}>
                          {new Date(msg.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Compose area */}
            <div className="shrink-0 border-t border-border bg-panel px-5 py-3">
              <form action={sendMessage} className="space-y-2">
                <input name="conversationId" type="hidden" value={active.id} />
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-2"
                  name="body"
                  placeholder="Type your message…"
                  required
                  rows={3}
                />
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-md border border-border bg-background px-2 py-2 text-sm"
                    defaultValue="outbound"
                    name="direction"
                  >
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                    <option value="internal">Internal note</option>
                  </select>
                  <button
                    className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
                    type="submit"
                  >
                    <Send size={14} />
                    Send
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
