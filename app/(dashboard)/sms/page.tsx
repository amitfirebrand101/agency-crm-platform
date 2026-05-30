import Link from "next/link";
import { MessageSquareText, Phone, Settings } from "lucide-react";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { twilioConfigured } from "@/lib/twilio";
import { releasePhoneNumber } from "./actions";
import { createPhoneNumber } from "@/app/(dashboard)/module-actions";
import { NumberProvisioner } from "./number-provisioner";

export default async function SmsPage() {
  const user = await requireUser();
  const isTwilioConfigured = twilioConfigured();

  let databaseUnavailable = false;

  type PhoneNumberRow = {
    id: string;
    number: string;
    provider: string | null;
    capability: string;
    status: string;
    twilioSid: string | null;
  };

  type SmsThread = {
    id: string;
    subject: string | null;
    status: string;
    updatedAt: Date;
    messages: Array<{ body: string; createdAt: Date; direction: string }>;
  };

  let phoneNumbers: PhoneNumberRow[] = [];
  let smsThreads: SmsThread[] = [];

  try {
    const [pns, threads] = await Promise.all([
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
          channel: "SMS",
        },
        select: {
          id: true,
          subject: true,
          status: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { body: true, createdAt: true, direction: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
    ]);
    phoneNumbers = pns;
    smsThreads = threads;
  } catch (error) {
    databaseUnavailable = true;
    console.error("SMS page database query failed", error);
  }

  async function releaseAction(formData: FormData): Promise<void> {
    "use server";
    await releasePhoneNumber(formData);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">SMS</h1>
          <p className="mt-1 text-sm text-muted">
            Manage SMS-capable numbers and view message threads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isTwilioConfigured ? "success" : "warning"}>
            Twilio: {isTwilioConfigured ? "Connected" : "Not configured"}
          </Badge>
        </div>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Left column */}
        <div className="space-y-4">
          {/* SMS threads */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquareText className="text-primary" size={18} />
                <h2 className="font-semibold">SMS threads</h2>
                <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                  {smsThreads.length}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <div className="divide-y divide-border">
                {smsThreads.map((thread) => {
                  const lastMessage = thread.messages[0];
                  return (
                    <Link
                      className="flex items-center justify-between py-3 hover:bg-background transition"
                      href={`/conversations/${thread.id}`}
                      key={thread.id}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{thread.subject ?? "SMS conversation"}</div>
                        {lastMessage ? (
                          <div className="mt-0.5 truncate text-xs text-muted max-w-xs">
                            {lastMessage.direction === "outbound" ? "You: " : ""}
                            {lastMessage.body}
                          </div>
                        ) : null}
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-2">
                        <Badge variant={statusVariant(thread.status)}>{thread.status}</Badge>
                        <span className="text-xs text-muted">
                          {new Date(thread.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  );
                })}
                {!smsThreads.length ? (
                  <p className="py-6 text-sm text-muted">
                    No SMS conversations yet. Inbound messages will appear here once you have a
                    provisioned number.
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>

          {/* Provisioned numbers */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Phone className="text-primary" size={18} />
                <h2 className="font-semibold">Your phone numbers</h2>
                <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                  {phoneNumbers.length}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <div className="divide-y divide-border">
                {phoneNumbers.map((pn) => (
                  <div className="flex items-center justify-between py-3" key={pn.id}>
                    <div>
                      <div className="font-medium font-mono">{pn.number}</div>
                      <div className="text-xs text-muted">
                        {pn.provider ?? "manual"} · {pn.capability}
                        {pn.twilioSid ? ` · ${pn.twilioSid}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(pn.status)}>{pn.status}</Badge>
                      <form action={releaseAction}>
                        <input name="id" type="hidden" value={pn.id} />
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
                {!phoneNumbers.length ? (
                  <p className="py-4 text-sm text-muted">
                    No phone numbers yet. Search for one in the panel on the right.
                  </p>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Manual / trial number entry — always visible */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Phone className="text-primary" size={18} />
                <h2 className="font-semibold">Add your number</h2>
              </div>
            </CardHeader>
            <CardBody>
              <p className="mb-3 text-sm text-muted">
                Already have a Twilio number? Paste it here (E.164 format, e.g.{" "}
                <span className="font-mono">+15550123456</span>). Then set{" "}
                <span className="font-mono text-xs">TWILIO_FROM_NUMBER</span> in Vercel to the same value.
              </p>
              <form action={createPhoneNumber} className="flex gap-2">
                <input
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono outline-none ring-primary/20 focus:ring-2"
                  name="number"
                  placeholder="+15550123456"
                  required
                  pattern="\+[0-9]{7,15}"
                  title="E.164 format: + followed by digits"
                />
                <input name="provider" type="hidden" value="twilio" />
                <SubmitButton
                  className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                  pendingText="Adding…"
                >
                  Add
                </SubmitButton>
              </form>
              <p className="mt-2 text-[11px] text-muted">
                Find your number at{" "}
                <a
                  className="text-primary underline"
                  href="https://console.twilio.com/us1/develop/phone-numbers/manage/active"
                  rel="noreferrer"
                  target="_blank"
                >
                  Twilio Console → Phone Numbers → Active Numbers
                </a>
              </p>
            </CardBody>
          </Card>

          {/* Twilio provisioner — paid accounts */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="text-primary" size={18} />
                <h2 className="font-semibold">Buy a new number</h2>
              </div>
            </CardHeader>
            <CardBody>
              {isTwilioConfigured ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Search for available US numbers by area code. Requires a paid Twilio account.
                  </p>
                  <NumberProvisioner />
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Configure{" "}
                  <span className="font-mono text-xs">TWILIO_ACCOUNT_SID</span>,{" "}
                  <span className="font-mono text-xs">TWILIO_AUTH_TOKEN</span>, and{" "}
                  <span className="font-mono text-xs">TWILIO_FROM_NUMBER</span> in Vercel to enable number search.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
