import { PhoneCall, Plus } from "lucide-react";
import { createPhoneNumber } from "@/app/(dashboard)/module-actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CallingPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let phoneNumbers: Awaited<ReturnType<typeof prisma.phoneNumber.findMany>> = [];

  try {
    phoneNumbers = await prisma.phoneNumber.findMany({ where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined }, orderBy: { createdAt: "desc" } });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Calling page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Calling</h1><p className="mt-1 text-sm text-muted">Phone inventory for voice, forwarding, voicemail, and provider setup.</p></div>
      {databaseUnavailable ? <DbWarning /> : null}
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card><CardHeader><div className="flex items-center gap-2"><PhoneCall className="text-primary" size={18} /><h2 className="font-semibold">Numbers</h2></div></CardHeader><CardBody><div className="divide-y divide-border">{phoneNumbers.map((phoneNumber) => <div className="flex items-center justify-between py-3" key={phoneNumber.id}><div><div className="font-medium">{phoneNumber.number}</div><div className="text-sm text-muted">{phoneNumber.provider ?? "manual"} / {phoneNumber.capability}</div></div><span className="rounded-md bg-background px-2 py-1 text-xs font-semibold text-muted">{phoneNumber.status}</span></div>)}{!phoneNumbers.length ? <div className="py-6 text-sm text-muted">No phone numbers yet.</div> : null}</div></CardBody></Card>
        <Card><CardHeader><div className="flex items-center gap-2"><Plus className="text-primary" size={18} /><h2 className="font-semibold">Add number</h2></div></CardHeader><CardBody><form action={createPhoneNumber} className="space-y-3"><Field label="Phone number" name="number" placeholder="+15550123456" required /><Field label="Provider" name="provider" placeholder="manual" /><button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">Save number</button></form></CardBody></Card>
      </section>
    </div>
  );
}
