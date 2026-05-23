import Link from "next/link";
import { MessageSquareText, Plus } from "lucide-react";
import { createPhoneNumber } from "@/app/(dashboard)/module-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SmsPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let phoneNumbers: Awaited<ReturnType<typeof prisma.phoneNumber.findMany>> = [];
  let smsThreads: Awaited<ReturnType<typeof prisma.conversation.findMany>> = [];

  try {
    [phoneNumbers, smsThreads] = await Promise.all([
      prisma.phoneNumber.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { createdAt: "desc" }
      }),
      prisma.conversation.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined, channel: "SMS" },
        orderBy: { updatedAt: "desc" },
        take: 50
      })
    ]);
  } catch (error) {
    databaseUnavailable = true;
    console.error("SMS page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">SMS</h1>
        <p className="mt-1 text-sm text-muted">
          SMS-capable phone numbers and message threads. Twilio/Telnyx integration required for outbound sending.
        </p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquareText className="text-primary" size={18} />
                <h2 className="font-semibold">SMS threads</h2>
                <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">{smsThreads.length}</span>
              </div>
            </CardHeader>
            <CardBody>
              <div className="divide-y divide-border">
                {smsThreads.map((thread) => (
                  <Link
                    className="flex items-center justify-between py-3 hover:bg-background transition"
                    href={`/conversations/${thread.id}`}
                    key={thread.id}
                  >
                    <div className="font-medium">{thread.subject ?? "SMS conversation"}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(thread.status)}>{thread.status}</Badge>
                      <span className="text-xs text-muted">{new Date(thread.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
                {!smsThreads.length ? (
                  <p className="py-6 text-sm text-muted">No SMS conversations yet.</p>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">SMS-capable numbers</h2>
            </CardHeader>
            <CardBody>
              <div className="divide-y divide-border">
                {phoneNumbers.map((pn) => (
                  <div className="flex items-center justify-between py-3" key={pn.id}>
                    <div className="font-medium font-mono">{pn.number}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{pn.provider ?? "manual"}</span>
                      <Badge variant={statusVariant(pn.status)}>{pn.status}</Badge>
                    </div>
                  </div>
                ))}
                {!phoneNumbers.length ? (
                  <p className="py-4 text-sm text-muted">No phone numbers. Add one below or in Calling.</p>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="text-primary" size={18} />
              <h2 className="font-semibold">Add SMS number</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createPhoneNumber} className="space-y-3">
              <Field label="Phone number" name="number" placeholder="+15550123456" required />
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Provider</span>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="provider">
                  <option value="manual">Manual</option>
                  <option value="twilio">Twilio</option>
                  <option value="telnyx">Telnyx</option>
                </select>
              </label>
              <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">
                Save number
              </button>
            </form>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
