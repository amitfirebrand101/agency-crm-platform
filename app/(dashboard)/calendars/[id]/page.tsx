import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createAppointment, updateAppointmentStatus } from "@/app/(dashboard)/module-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MonthGrid } from "./month-grid";

type Props = { params: Promise<{ id: string }> };

type CalendarDetail = Prisma.CalendarGetPayload<{
  include: { appointments: { orderBy: { startsAt: "asc" }; include: { contact: true } } };
}>;

export default async function CalendarDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  let calendar: CalendarDetail | null = null;
  let contacts: Array<{ id: string; firstName: string; lastName: string | null; email: string | null }> = [];

  try {
    [calendar, contacts] = await Promise.all([
      prisma.calendar.findFirst({
        where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        include: { appointments: { orderBy: { startsAt: "asc" }, include: { contact: true } } },
      }),
      prisma.contact.findMany({
        where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        orderBy: { firstName: "asc" },
        take: 100,
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
    ]);
  } catch (error) {
    console.error("Calendar detail page database query failed", error);
  }

  if (!calendar) notFound();

  const STATUS_OPTIONS = ["scheduled", "confirmed", "cancelled", "completed", "no_show"] as const;

  const now = new Date();

  // Upcoming: next 30 days, up to 20 appointments
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcoming = calendar.appointments
    .filter((a) => new Date(a.startsAt) >= now && new Date(a.startsAt) <= thirtyDays)
    .slice(0, 20);

  const nowIso = now.toISOString().slice(0, 16);
  const oneHourLater = new Date(now.getTime() + 3600000).toISOString().slice(0, 16);

  // Serialize appointments for the client MonthGrid (ISO strings, no Date objects)
  const appointmentData = calendar.appointments.map((apt) => ({
    id: apt.id,
    title: apt.title,
    startsAt: apt.startsAt.toISOString(),
    endsAt: apt.endsAt.toISOString(),
    status: apt.status,
    contact: apt.contact
      ? { id: apt.contact.id, firstName: apt.contact.firstName, lastName: apt.contact.lastName }
      : null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground" href="/calendars">
          <ArrowLeft size={15} />
          Calendars
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{calendar.name}</h1>
          <p className="mt-1 text-sm text-muted">{calendar.timezone || "No timezone set"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted">{calendar.appointments.length} total</Badge>
          <Badge variant="info">{upcoming.length} upcoming</Badge>
          <Link
            href={`/calendars/${calendar.id}/availability`}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition"
          >
            Availability
          </Link>
          <Link
            href={`/book/${(calendar as { bookingPageSlug?: string | null }).bookingPageSlug ?? calendar.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
          >
            Booking page ↗
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Month grid */}
          <MonthGrid
            appointments={appointmentData}
            initialYear={now.getFullYear()}
            initialMonth={now.getMonth()}
          />

          {/* Upcoming appointments list */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="text-primary" size={18} />
                <h2 className="font-semibold">Upcoming (next 30 days)</h2>
                <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                  {upcoming.length}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              <div className="divide-y divide-border">
                {upcoming.map((apt) => (
                  <div className="py-3" key={apt.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{apt.title}</p>
                        {apt.contact ? (
                          <Link
                            className="text-sm text-muted hover:text-primary"
                            href={`/contacts/${apt.contact.id}`}
                          >
                            {apt.contact.firstName} {apt.contact.lastName ?? ""}
                          </Link>
                        ) : (
                          <p className="text-sm text-muted">No contact</p>
                        )}
                        <p className="text-xs text-muted">
                          {new Date(apt.startsAt).toLocaleString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" — "}
                          {new Date(apt.endsAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <Badge variant={statusVariant(apt.status)}>{apt.status.replace("_", " ")}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {STATUS_OPTIONS.map((s) => (
                        <form action={updateAppointmentStatus} key={s}>
                          <input name="appointmentId" type="hidden" value={apt.id} />
                          <input name="status" type="hidden" value={s} />
                          <SubmitButton
                            className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                              apt.status === s
                                ? "bg-primary text-white"
                                : "border border-border hover:bg-background"
                            }`}
                            pendingText="Saving…"
                          >
                            {s.replace("_", " ")}
                          </SubmitButton>
                        </form>
                      ))}
                    </div>
                  </div>
                ))}
                {!upcoming.length ? (
                  <p className="py-4 text-center text-sm text-muted">No upcoming appointments in the next 30 days.</p>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* New appointment form */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">New appointment</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={createAppointment} className="space-y-3">
                <input name="calendarId" type="hidden" value={calendar.id} />
                <Field label="Title" name="title" placeholder="Discovery call" required />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Contact (optional)
                  </span>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    name="contactId"
                  >
                    <option value="">No contact</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName ?? ""} {c.email ? `(${c.email})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Starts at
                  </span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    defaultValue={nowIso}
                    name="startsAt"
                    required
                    type="datetime-local"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Ends at
                  </span>
                  <input
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    defaultValue={oneHourLater}
                    name="endsAt"
                    required
                    type="datetime-local"
                  />
                </label>
                <SubmitButton
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                  pendingText="Booking…"
                >
                  Book appointment
                </SubmitButton>
              </form>
            </CardBody>
          </Card>

          {/* Calendar info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="text-primary" size={18} />
                <h2 className="font-semibold">Calendar info</h2>
              </div>
            </CardHeader>
            <CardBody>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Name</dt>
                  <dd className="mt-0.5 font-medium">{calendar.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Timezone</dt>
                  <dd className="mt-0.5 text-muted">{calendar.timezone || "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Total appointments
                  </dt>
                  <dd className="mt-0.5">
                    <Badge variant="info">{calendar.appointments.length}</Badge>
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
