import { MessageSquareText, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createConversation } from "@/app/(dashboard)/module-actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ConversationWithContact = Prisma.ConversationGetPayload<{
  include: { contact: true; messages: { orderBy: { createdAt: "desc" }; take: 1 } };
}>;

export default async function ConversationsPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let conversations: ConversationWithContact[] = [];

  try {
    conversations = await prisma.conversation.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { contact: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } }
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Conversations page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="mt-1 text-sm text-muted">Unified inbox records for SMS, email, calls, voicemail, and internal notes.</p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquareText className="text-primary" size={18} />
              <h2 className="font-semibold">Threads</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-border">
              {conversations.map((conversation) => (
                <div className="flex items-center justify-between gap-4 py-3" key={conversation.id}>
                  <div>
                    <div className="font-medium">{conversation.subject ?? `${conversation.channel} conversation`}</div>
                    <div className="text-sm text-muted">{conversation.contact?.email ?? conversation.contact?.phone ?? "Unassigned contact"}</div>
                  </div>
                  <span className="rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted">{conversation.status}</span>
                </div>
              ))}
              {!conversations.length ? <div className="py-6 text-sm text-muted">No conversations yet.</div> : null}
            </div>
          </CardBody>
        </Card>
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
              <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="channel" defaultValue="SMS">
                <option value="SMS">SMS</option>
                <option value="EMAIL">Email</option>
                <option value="CALL">Call</option>
                <option value="VOICEMAIL">Voicemail</option>
                <option value="INTERNAL_NOTE">Internal note</option>
              </select>
              <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">Create thread</button>
            </form>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
