import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Mail,
  MessageSquare,
  Phone,
  Target,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import type { Prisma } from "@prisma/client";
import {
  deleteOpportunity,
  moveOpportunityToStage,
  updateOpportunity,
} from "@/app/(dashboard)/module-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type OpportunityDetail = Prisma.OpportunityGetPayload<{
  include: {
    stage: { include: { pipeline: true } };
    contact: {
      include: {
        conversations: true;
        appointments: {
          include: { calendar: { select: { name: true; timezone: true } } };
        };
      };
    };
  };
}>;

type PipelineWithStages = Prisma.PipelineGetPayload<{
  include: { stages: { orderBy: { position: "asc" } } };
}>;

type AutomationEventRow = {
  id: string;
  type: string;
  source: string;
  createdAt: Date;
};

const AVATAR_COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#6366f1",
];

function avatarBg(name: string): string {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

function relativeTime(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1mo ago";
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default async function OpportunityDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  let opportunity: OpportunityDetail | null = null;
  let pipelines: PipelineWithStages[] = [];
  let automationEvents: AutomationEventRow[] = [];
  let dbError = false;

  try {
    [opportunity, pipelines] = await Promise.all([
      prisma.opportunity.findFirst({
        where: {
          id,
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
        },
        include: {
          stage: { include: { pipeline: true } },
          contact: {
            include: {
              conversations: { orderBy: { createdAt: "desc" }, take: 5 },
              appointments: {
                orderBy: { startsAt: "desc" },
                take: 5,
                include: { calendar: { select: { name: true, timezone: true } } },
              },
            },
          },
        },
      }),
      prisma.pipeline.findMany({
        where: {
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
        },
        include: {
          stages: { orderBy: { position: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Load automation events linked to the contact if one is present
    if (opportunity?.contactId) {
      automationEvents = await prisma.automationEvent.findMany({
        where: {
          agencyId: user.agencyId,
          subAccountId: user.subAccountId ?? undefined,
          contactId: opportunity.contactId,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, type: true, source: true, createdAt: true },
      });
    }
  } catch (error) {
    console.error("Opportunity detail page database query failed", error);
    dbError = true;
  }

  if (dbError) {
    return (
      <div className="space-y-6">
        <Link
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
          href="/opportunities"
        >
          <ArrowLeft size={15} />
          Opportunities
        </Link>
        <DbWarning />
      </div>
    );
  }

  if (!opportunity) notFound();

  const contactName = opportunity.contact
    ? `${opportunity.contact.firstName} ${opportunity.contact.lastName ?? ""}`.trim()
    : null;
  const contactInitial = contactName ? contactName.charAt(0).toUpperCase() : null;

  const valueFormatted = (opportunity.valueCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const closeDateValue = opportunity.closeDate
    ? opportunity.closeDate.toISOString().slice(0, 10)
    : "";

  // Build merged activity feed
  type FeedItem = {
    id: string;
    icon: "message" | "calendar" | "automation";
    label: string;
    detail: string;
    date: Date;
  };

  const feed: FeedItem[] = [];

  if (opportunity.contact) {
    for (const conv of opportunity.contact.conversations) {
      const firstName = opportunity.contact.firstName;
      const channelLabel =
        conv.channel === "EMAIL"
          ? `Email from ${firstName}`
          : conv.channel === "SMS"
            ? `SMS from ${firstName}`
            : conv.channel === "CALL"
              ? `Call with ${firstName}`
              : `Message from ${firstName}`;
      feed.push({
        id: conv.id,
        icon: "message",
        label: channelLabel,
        detail: conv.subject ?? conv.channel,
        date: new Date(conv.createdAt),
      });
    }

    for (const apt of opportunity.contact.appointments) {
      feed.push({
        id: apt.id,
        icon: "calendar",
        label: apt.title,
        detail: apt.calendar.name,
        date: new Date(apt.startsAt),
      });
    }
  }

  for (const evt of automationEvents) {
    feed.push({
      id: evt.id,
      icon: "automation",
      label: evt.type.replace(/_/g, " "),
      detail: `via ${evt.source}`,
      date: new Date(evt.createdAt),
    });
  }

  feed.sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentFeed = feed.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        href="/opportunities"
      >
        <ArrowLeft size={15} />
        Opportunities
      </Link>

      {/* Hero card */}
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Target className="text-primary" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{opportunity.name}</h1>
                <p className="text-sm text-muted">
                  {opportunity.stage.pipeline.name} &rarr; {opportunity.stage.name}
                </p>
                <div className="mt-1">
                  <Badge variant={statusVariant(opportunity.status)}>
                    {opportunity.status}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">${valueFormatted}</p>
              <p className="text-xs text-muted">Deal value</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Main two-column layout */}
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Edit opportunity form */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Opportunity details</h2>
            </CardHeader>
            <CardBody>
              <form action={updateOpportunity} className="space-y-4">
                <input name="opportunityId" type="hidden" value={opportunity.id} />
                <Field
                  label="Opportunity name"
                  name="name"
                  defaultValue={opportunity.name}
                  required
                />
                <Field
                  label="Value ($)"
                  name="value"
                  type="number"
                  defaultValue={(opportunity.valueCents / 100).toFixed(2)}
                />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Status
                  </span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    defaultValue={opportunity.status}
                    name="status"
                  >
                    <option value="OPEN">Open</option>
                    <option value="WON">Won</option>
                    <option value="LOST">Lost</option>
                  </select>
                </label>

                {/* Lost reason — always rendered, labelled to explain conditionality */}
                <div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Reason for loss (required if lost)
                    </span>
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                      defaultValue={opportunity.lostReason ?? ""}
                      maxLength={500}
                      name="lostReason"
                      placeholder="e.g. Budget, competitor, timing…"
                      type="text"
                    />
                  </label>
                </div>

                {/* Close date */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Close date
                  </span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    defaultValue={closeDateValue}
                    name="closeDate"
                    type="date"
                  />
                </label>

                {/* Notes */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Notes
                  </span>
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4 resize-y"
                    defaultValue={opportunity.notes ?? ""}
                    maxLength={5000}
                    name="notes"
                    placeholder="Add any notes about this deal…"
                    rows={4}
                  />
                </label>

                <SubmitButton
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                  pendingText="Saving…"
                >
                  Save changes
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          {/* Notes readonly display (when notes exist) */}
          {opportunity.notes ? (
            <Card className="bg-muted/30">
              <CardHeader>
                <h2 className="font-semibold text-sm">Deal notes</h2>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">
                  {opportunity.notes}
                </p>
              </CardBody>
            </Card>
          ) : null}

          {/* Move to stage form */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Move to stage</h2>
            </CardHeader>
            <CardBody>
              <form action={moveOpportunityToStage} className="space-y-4">
                <input name="opportunityId" type="hidden" value={opportunity.id} />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Pipeline &amp; stage
                  </span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    defaultValue={opportunity.stageId}
                    name="stageId"
                  >
                    {pipelines.map((pipeline) => (
                      <optgroup key={pipeline.id} label={pipeline.name}>
                        {pipeline.stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <SubmitButton
                  className="rounded-md border border-border px-4 py-2 text-sm font-semibold transition hover:bg-background"
                  pendingText="Moving…"
                >
                  Move opportunity
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Current stage / pipeline */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Pipeline position</h2>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-border text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Pipeline</dt>
                  <dd className="font-semibold">{opportunity.stage.pipeline.name}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Stage</dt>
                  <dd>
                    <Badge variant="default">{opportunity.stage.name}</Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Status</dt>
                  <dd>
                    <Badge variant={statusVariant(opportunity.status)}>
                      {opportunity.status}
                    </Badge>
                  </dd>
                </div>
                {opportunity.closeDate ? (
                  <div className="flex items-center justify-between py-2.5">
                    <dt className="text-muted">Close date</dt>
                    <dd className="font-semibold">
                      {new Date(opportunity.closeDate).toLocaleDateString()}
                    </dd>
                  </div>
                ) : null}
                {opportunity.lostReason ? (
                  <div className="flex items-start justify-between gap-3 py-2.5">
                    <dt className="shrink-0 text-muted">Lost reason</dt>
                    <dd className="text-right text-xs text-foreground/80 font-medium">
                      {opportunity.lostReason}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </CardBody>
          </Card>

          {/* Linked contact */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="text-primary" size={16} />
                <h2 className="font-semibold">Linked contact</h2>
              </div>
            </CardHeader>
            <CardBody>
              {opportunity.contact && contactName ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: avatarBg(contactName) }}
                    >
                      {contactInitial}
                    </div>
                    <div className="min-w-0">
                      <Link
                        className="block truncate font-semibold text-sm hover:text-primary"
                        href={`/contacts/${opportunity.contact.id}`}
                      >
                        {contactName}
                      </Link>
                      {opportunity.contact.companyName ? (
                        <p className="truncate text-xs text-muted">
                          {opportunity.contact.companyName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="divide-y divide-border text-sm">
                    {opportunity.contact.email ? (
                      <div className="flex items-center gap-2 py-2">
                        <Mail className="shrink-0 text-muted" size={13} />
                        <a
                          className="truncate text-xs hover:text-primary"
                          href={`mailto:${opportunity.contact.email}`}
                        >
                          {opportunity.contact.email}
                        </a>
                      </div>
                    ) : null}
                    {opportunity.contact.phone ? (
                      <div className="flex items-center gap-2 py-2">
                        <Phone className="shrink-0 text-muted" size={13} />
                        <a
                          className="truncate text-xs hover:text-primary"
                          href={`tel:${opportunity.contact.phone}`}
                        >
                          {opportunity.contact.phone}
                        </a>
                      </div>
                    ) : null}
                    {opportunity.contact.companyName ? (
                      <div className="flex items-center gap-2 py-2">
                        <Building2 className="shrink-0 text-muted" size={13} />
                        <span className="truncate text-xs text-muted">
                          {opportunity.contact.companyName}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5 pt-1">
                    <Link
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      href={`/contacts/${opportunity.contact.id}`}
                    >
                      View contact &rarr;
                    </Link>
                    <Link
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      href={`/conversations?contactId=${opportunity.contact.id}`}
                    >
                      View conversations &rarr;
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted">No contact linked to this opportunity.</p>
                  <Link
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    href="/contacts"
                  >
                    Browse contacts &rarr;
                  </Link>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Activity feed */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Recent activity</h2>
            </CardHeader>
            <CardBody>
              {recentFeed.length === 0 ? (
                <p className="text-sm text-muted">No activity yet.</p>
              ) : (
                <ul className="space-y-3">
                  {recentFeed.map((item) => (
                    <li key={item.id} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/40">
                        {item.icon === "message" ? (
                          <MessageSquare className="text-muted" size={13} />
                        ) : item.icon === "calendar" ? (
                          <CalendarDays className="text-muted" size={13} />
                        ) : (
                          <Zap className="text-muted" size={13} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.label}</p>
                        <p className="truncate text-xs text-muted">{item.detail}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {relativeTime(item.date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Opportunity stats</h2>
            </CardHeader>
            <CardBody>
              <dl className="divide-y divide-border text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Value</dt>
                  <dd className="font-semibold">${valueFormatted}</dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Status</dt>
                  <dd>
                    <Badge variant={statusVariant(opportunity.status)}>
                      {opportunity.status}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Created</dt>
                  <dd className="font-semibold">
                    {new Date(opportunity.createdAt).toLocaleDateString()}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted">Last updated</dt>
                  <dd className="font-semibold">
                    {new Date(opportunity.updatedAt).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          {/* Danger zone */}
          <Card>
            <CardBody>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Danger zone
              </p>
              <form action={deleteOpportunity}>
                <input name="opportunityId" type="hidden" value={opportunity.id} />
                <SubmitButton
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  pendingText="Deleting…"
                >
                  <Trash2 size={15} />
                  Delete opportunity
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
