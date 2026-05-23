import { MessageSquareText, Plus } from "lucide-react";
import { createPhoneNumber } from "@/app/(dashboard)/module-actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SmsPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let [phoneNumbers, smsThreads]: [
    Awaited<ReturnType<typeof prisma.phoneNumber.findMany>>,
    Awaited<ReturnType<typeof prisma.conversation.findMany>>
  ] = [[], []];

  try {
    [phoneNumbers, smsThreads] = await Promise.all([
      prisma.phoneNumber.findMany({ where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined }, orderBy: { createdAt: "desc" } }),
      prisma.conversation.findMany({ where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined, channel: "SMS" }, orderBy: { updatedAt: "desc" }, take: 25 })
    ]);
  } catch (error) {
    databaseUnavailable = true;
    console.error("SMS page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">SMS</h1><p className="mt-1 text-sm text-muted">SMS-ready number inventory and message thread records. Compliance workflows come next.</p></div>
      {databaseUnavailable ? <DbWarning /> : null}
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card><CardHeader><div className="flex items-center gap-2"><MessageSquareText className="text-primary" size={18} /><h2 className="font-semibold">SMS threads</h2></div></CardHeader><CardBody><div className="divide-y divide-border">{smsThreads.map((thread) => <div className="flex items-center justify-between py-3" key={thread.id}><div className="font-medium">{thread.subject ?? "SMS conversation"}</div><span className="rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted">{thread.status}</span></div>)}{!smsThreads.length ? <div className="py-6 text-sm text-muted">No SMS conversations yet.</div> : null}</div></CardBody></Card>
          <Card><CardHeader><h2 className="font-semibold">SMS numbers</h2></CardHeader><CardBody><div className="divide-y divide-border">{phoneNumbers.map((phoneNumber) => <div className="flex items-center justify-between py-3" key={phoneNumber.id}><div className="font-medium">{phoneNumber.number}</div><span className="rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted">{phoneNumber.status}</span></div>)}</div></CardBody></Card>
        </div>
        <Card><CardHeader><div className="flex items-center gap-2"><Plus className="text-primary" size={18} /><h2 className="font-semibold">Add SMS number</h2></div></CardHeader><CardBody><form action={createPhoneNumber} className="space-y-3"><Field label="Phone number" name="number" placeholder="+15550123456" required /><Field label="Provider" name="provider" placeholder="manual" /><button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">Save number</button></form></CardBody></Card>
      </section>
    </div>
  );
}
