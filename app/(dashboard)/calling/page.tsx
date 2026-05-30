import { PhoneCall, PhoneOff, PhoneIncoming, Shield } from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { twilioConfigured, voiceConfigured } from "@/lib/twilio";
import { releasePhoneNumber } from "@/app/(dashboard)/sms/actions";
import { ClickToCall } from "./click-to-call";

export default async function CallingPage() {
  const user = await requireUser();
  const isTwilioConfigured = twilioConfigured();
  const isVoiceConfigured = voiceConfigured();

  let databaseUnavailable = false;

  type PhoneNumberRow = {
    id: string;
    number: string;
    provider: string | null;
    capability: string;
    status: string;
    twilioSid: string | null;
  };

  type CallThread = {
    id: string;
    subject: string | null;
    status: string;
    updatedAt: Date;
    contact: { firstName: string; lastName: string | null; phone: string | null } | null;
    messages: Array<{ body: string; createdAt: Date; direction: string }>;
  };

  let phoneNumbers: PhoneNumberRow[] = [];
  let recentCalls: CallThread[] = [];

  try {
    const [pns, calls] = await Promise.all([
      prisma.phoneNumber.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          provider: true,
          capability: true,
          status: true,
          twilioSid: true,
        },
      }),
      prisma.conversation.findMany({
        where: {
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
          channel: "CALL",
        },
        select: {
          id: true,
          subject: true,
          status: true,
          updatedAt: true,
          contact: {
            select: { firstName: true, lastName: true, phone: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, direction: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
    ]);
    phoneNumbers = pns;
    recentCalls = calls;
  } catch (error) {
    databaseUnavailable = true;
    console.error("Calling page database query failed", error);
  }

  const CAPABILITY_LABELS: Record<string, string> = {
    sms_voice: "SMS + Voice",
    voice_only: "Voice only",
    sms_only: "SMS only",
  };

  async function releaseAction(formData: FormData): Promise<void> {
    "use server";
    await releasePhoneNumber(formData);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Calling</h1>
          <p className="mt-1 text-sm text-muted">
            Phone number inventory, recent calls, and browser-based dialer.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant={isTwilioConfigured ? "success" : "warning"}>
            Twilio: {isTwilioConfigured ? "Connected" : "Not configured"}
          </Badge>
          <Badge variant={isVoiceConfigured ? "success" : "warning"}>
            Voice SDK: {isVoiceConfigured ? "Ready" : "Not configured"}
          </Badge>
        </div>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Recent calls */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PhoneIncoming className="text-primary" size={18} />
                <h2 className="font-semibold">Recent calls</h2>
                <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                  {recentCalls.length}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              {recentCalls.length > 0 ? (
                <div className="divide-y divide-border">
                  {recentCalls.map((call) => {
                    const contactName = call.contact
                      ? [call.contact.firstName, call.contact.lastName].filter(Boolean).join(" ")
                      : null;
                    const lastMessage = call.messages[0];
                    return (
                      <div className="flex items-center justify-between py-3" key={call.id}>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">
                            {contactName ?? call.subject ?? "Unknown caller"}
                          </div>
                          {call.contact?.phone ? (
                            <div className="text-xs text-muted font-mono">{call.contact.phone}</div>
                          ) : null}
                          {lastMessage ? (
                            <div className="mt-0.5 truncate text-xs text-muted max-w-xs">
                              {lastMessage.body}
                            </div>
                          ) : null}
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          <Badge variant={statusVariant(call.status)}>{call.status}</Badge>
                          <span className="text-xs text-muted">
                            {new Date(call.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <PhoneOff className="mx-auto mb-4 text-muted" size={32} />
                  <p className="font-medium">No calls yet</p>
                  <p className="mt-1 text-sm text-muted">
                    Inbound calls will appear here once you have a provisioned number.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Phone numbers */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PhoneCall className="text-primary" size={18} />
                <h2 className="font-semibold">Phone numbers</h2>
                <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                  {phoneNumbers.length}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              {phoneNumbers.length > 0 ? (
                <div className="divide-y divide-border">
                  {phoneNumbers.map((phoneNumber) => (
                    <div className="flex items-center justify-between py-3" key={phoneNumber.id}>
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <PhoneCall size={15} />
                        </div>
                        <div>
                          <div className="font-medium font-mono">{phoneNumber.number}</div>
                          <div className="text-sm text-muted">
                            {phoneNumber.provider ?? "manual"} ·{" "}
                            {CAPABILITY_LABELS[phoneNumber.capability] ?? phoneNumber.capability}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(phoneNumber.status)}>
                          {phoneNumber.status}
                        </Badge>
                        <form action={releaseAction}>
                          <input name="id" type="hidden" value={phoneNumber.id} />
                          <button
                            className="rounded border border-border px-2 py-1 text-xs text-muted hover:border-red-300 hover:text-red-600 transition"
                            type="submit"
                          >
                            Release
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <PhoneOff className="mx-auto mb-4 text-muted" size={32} />
                  <p className="font-medium">No phone numbers yet</p>
                  <p className="mt-1 text-sm text-muted">
                    Provision a number from the SMS page to get started.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* A2P compliance notice */}
          <Card>
            <CardBody>
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 shrink-0 text-primary" size={18} />
                <div>
                  <p className="text-sm font-semibold">A2P/10DLC compliance</p>
                  <p className="mt-1 text-sm text-muted">
                    US-based SMS requires A2P 10DLC registration for campaign messages. Register
                    your brand and campaigns through your Twilio dashboard before sending at scale.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Click-to-call panel */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PhoneCall className="text-primary" size={18} />
                <h2 className="font-semibold">Browser dialer</h2>
              </div>
            </CardHeader>
            <CardBody>
              <ClickToCall voiceReady={isVoiceConfigured} />
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
