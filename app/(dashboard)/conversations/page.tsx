import Link from "next/link";
import { MessageSquareText, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createConversation } from "@/app/(dashboard)/module-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ConversationWithContact = Prisma.ConversationGetPayload<{
  include: { contact: true; messages: { orderBy: { createdAt: "desc" }; take: 1 } };
}>;

export default async function ConversationsPage({
  searchParams
}: {
  searchParams?: Promise<{ channel?: string; status?: string }>;
}) {
  const params = await searchParams;
  const channelFilter = params?.channel ?? "";
  const statusFilter = params?.status ?? "";

  const user = await requireUser();
  let databaseUnavailable = false;
  let conversations: ConversationWithContact[] = [];

  try {
    const where: Prisma.ConversationWhereInput = {
      agencyId: user.agencyId,
      subAccountId: user.subAccountId ?? undefined,
      ...(channelFilter ? { channel: channelFilter as Prisma.EnumConversationChannelFilter } : {}),
      ...(statusFilter ? { status: statusFilter as Prisma.EnumConversationStatusFilter } : {})
    };

    conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { contact: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } }
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Conversations page database query failed", error);
  }

  const CHANNEL_LABELS: Record<string, string> = {
    SMS: "SMS",
    EMAIL: "Email",
    CALL: "Call",
    VOICEMAIL: "Voicemail",
    INTERNAL_NOTE: "Note"
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="mt-1 text-sm text-muted">Unified inbox for SMS, email, calls, voicemail, and internal notes.</p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="text-primary" size={18} />
                  <h2 className="font-semibold">Threads</h2>
                  <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">{conversations.length}</span>
                </div>
                <form className="flex gap-2" method="GET">
                  <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" defaultValue={channelFilter} name="channel">
                    <option value="">All channels</option>
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">Email</option>
                    <option value="CALL">Call</option>
                    <option value="VOICEMAIL">Voicemail</option>
                    <option value="INTERNAL_NOTE">Internal note</option>
                  </select>
                  <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" defaultValue={statusFilter} name="status">
                    <option value="">All statuses</option>
                    <option value="OPEN">Open</option>
                    <option value="PENDING">Pending</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                  <button className="h-9 rounded-md border border-border px-3 text-sm font-medium" type="submit">
                    Filter
                  </button>
                </form>
              </div>
            </CardHeader>
            <CardBody>
              <div className="divide-y divide-border">
                {conversations.map((conversation) => {
                  const lastMessage = conversation.messages[0];
                  return (
                    <Link
                      className="flex items-center gap-4 py-3 transition hover:bg-background"
                      href={`/conversations/${conversation.id}`}
                      key={conversation.id}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {(CHANNEL_LABELS[conversation.channel] ?? "?").slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {conversation.subject ?? `${CHANNEL_LABELS[conversation.channel] ?? conversation.channel} conversation`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted">
                          {conversation.contact
                            ? `${conversation.contact.firstName} ${conversation.contact.lastName ?? ""}`
                            : "Unassigned"}
                          {lastMessage ? ` · ${lastMessage.body.slice(0, 50)}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge variant={statusVariant(conversation.status)}>{conversation.status}</Badge>
                        <span className="text-xs text-muted">{new Date(conversation.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  );
                })}
                {!conversations.length ? (
                  <p className="py-6 text-center text-sm text-muted">No conversations found.</p>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="text-primary" size={18} />
              <h2 className="font-semibold">New thread</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createConversation} className="space-y-3">
              <Field label="Subject" name="subject" placeholder="New lead follow-up" />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Channel</span>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" defaultValue="SMS" name="channel">
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="CALL">Call</option>
                  <option value="VOICEMAIL">Voicemail</option>
                  <option value="INTERNAL_NOTE">Internal note</option>
                </select>
              </label>
              <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">
                Create thread
              </button>
            </form>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
