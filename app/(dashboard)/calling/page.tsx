import { PhoneCall, PhoneOff, Plus, Shield } from "lucide-react";
import { createPhoneNumber } from "@/app/(dashboard)/module-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CallingPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let phoneNumbers: Awaited<ReturnType<typeof prisma.phoneNumber.findMany>> = [];

  try {
    phoneNumbers = await prisma.phoneNumber.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "desc" }
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Calling page database query failed", error);
  }

  const CAPABILITY_LABELS: Record<string, string> = {
    sms_voice: "SMS + Voice",
    voice_only: "Voice only",
    sms_only: "SMS only"
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Calling</h1>
        <p className="mt-1 text-sm text-muted">
          Phone number inventory for voice, forwarding, and voicemail. Twilio/Telnyx integration required for live calling.
        </p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PhoneCall className="text-primary" size={18} />
                <h2 className="font-semibold">Phone numbers</h2>
                <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">{phoneNumbers.length}</span>
              </div>
            </CardHeader>
            <CardBody>
              {phoneNumbers.length > 0 ? (
                <div className="divide-y divide-border">
                  {phoneNumbers.map((phoneNumber) => (
                    <div className="flex items-center justify-between py-3" key={phoneNumber.id}>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <PhoneCall size={15} />
                        </div>
                        <div>
                          <div className="font-medium font-mono">{phoneNumber.number}</div>
                          <div className="text-sm text-muted">
                            {phoneNumber.provider ?? "manual"} · {CAPABILITY_LABELS[phoneNumber.capability] ?? phoneNumber.capability}
                          </div>
                        </div>
                      </div>
                      <Badge variant={statusVariant(phoneNumber.status)}>{phoneNumber.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <PhoneOff className="mx-auto mb-4 text-muted" size={32} />
                  <p className="font-medium">No phone numbers yet</p>
                  <p className="mt-1 text-sm text-muted">Add a number to track your phone inventory.</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 shrink-0 text-primary" size={18} />
                <div>
                  <p className="font-semibold text-sm">A2P/10DLC compliance</p>
                  <p className="mt-1 text-sm text-muted">
                    US-based SMS requires A2P 10DLC registration for campaign messages. Register your brand and campaigns
                    through your Twilio or Telnyx dashboard before sending at scale.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">Add number</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createPhoneNumber} className="space-y-3">
                <Field label="Phone number" name="number" placeholder="+15550123456" required />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Provider</span>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" name="provider">
                    <option value="manual">Manual (no provider)</option>
                    <option value="twilio">Twilio</option>
                    <option value="telnyx">Telnyx</option>
                  </select>
                </label>
                <SubmitButton className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" pendingText="Saving…">
                  Save number
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Provider status</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Twilio</span>
                  <Badge variant="warning">Not connected</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Telnyx</span>
                  <Badge variant="warning">Not connected</Badge>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
