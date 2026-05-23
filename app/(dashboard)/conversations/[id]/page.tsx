import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { sendMessage, updateConversationStatus } from "@/app/(dashboard)/conversations/[id]/actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

type ConversationDetail = Prisma.ConversationGetPayload<{
  include: { contact: true; messages: { orderBy: { createdAt: "asc" } } };
}>;

export default async function ConversationDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  let conversation: ConversationDetail | null = null;

  try {
    conversation = await prisma.conversation.findFirst({
      where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: "asc" } }
      }
    });
  } catch (error) {
    console.error("Conversation detail page database query failed", error);
  }

  if (!conversation) notFound();

  const CHANNEL_LABELS: Record<string, string> = {
    SMS: "SMS",
    EMAIL: "Email",
    CALL: "Call",
    VOICEMAIL: "Voicemail",
    INTERNAL_NOTE: "Internal note"
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground" href="/conversations">
          <ArrowLeft size={15} />
          Conversations
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{conversation.subject ?? `${CHANNEL_LABELS[conversation.channel] ?? conversation.channel} conversation`}</h1>
          {conversation.contact ? (
            <Link className="text-sm text-muted hover:text-primary" href={`/contacts/${conversation.contact.id}`}>
              {conversation.contact.firstName} {conversation.contact.lastName ?? ""}{" "}
              {conversation.contact.email ? `(${conversation.contact.email})` : ""}
            </Link>
          ) : (
            <span className="text-sm text-muted">Unassigned contact</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(conversation.status)}>{conversation.status}</Badge>
          <Badge variant="muted">{CHANNEL_LABELS[conversation.channel] ?? conversation.channel}</Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          {/* Message thread */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Messages</h2>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {conversation.messages.map((msg) => (
                  <div
                    className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    key={msg.id}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                        msg.direction === "outbound"
                          ? "bg-primary text-white"
                          : msg.direction === "internal"
                          ? "border border-amber-200 bg-amber-50 text-amber-900"
                          : "border border-border bg-background text-foreground"
                      }`}
                    >
                      <p>{msg.body}</p>
                      <p className="mt-1 text-xs opacity-60">{new Date(msg.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {!conversation.messages.length ? (
                  <p className="py-6 text-center text-sm text-muted">No messages yet.</p>
                ) : null}
              </div>
            </CardBody>
          </Card>

          {/* Send message */}
          <Card>
            <CardBody>
              <form action={sendMessage} className="space-y-3">
                <input name="conversationId" type="hidden" value={conversation.id} />
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                  name="body"
                  placeholder="Type your message…"
                  required
                  rows={3}
                />
                <div className="flex gap-2">
                  <select className="rounded-md border border-border bg-background px-2 py-2 text-sm" defaultValue="outbound" name="direction">
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                    <option value="internal">Internal note</option>
                  </select>
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white" type="submit">
                    <Send size={14} />
                    Send
                  </button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Status</h2>
            </CardHeader>
            <CardBody className="space-y-2">
              {(["OPEN", "PENDING", "CLOSED"] as const).map((s) => (
                <form action={updateConversationStatus} key={s}>
                  <input name="conversationId" type="hidden" value={conversation!.id} />
                  <input name="status" type="hidden" value={s} />
                  <button
                    className={`w-full rounded-md px-3 py-2 text-sm font-semibold transition ${
                      conversation!.status === s
                        ? "bg-primary/10 text-primary"
                        : "border border-border hover:bg-background"
                    }`}
                    type="submit"
                  >
                    {s}
                  </button>
                </form>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Channel</dt>
                  <dd className="font-semibold">{CHANNEL_LABELS[conversation.channel] ?? conversation.channel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Messages</dt>
                  <dd className="font-semibold">{conversation.messages.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Created</dt>
                  <dd className="font-semibold">{new Date(conversation.createdAt).toLocaleDateString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Updated</dt>
                  <dd className="font-semibold">{new Date(conversation.updatedAt).toLocaleDateString()}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
