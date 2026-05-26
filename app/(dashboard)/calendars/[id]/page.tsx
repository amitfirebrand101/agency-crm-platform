import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, GripVertical, Plus, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createAppointment, updateAppointmentStatus } from "@/app/(dashboard)/module-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MonthGrid } from "./month-grid";
import { addCalendarQuestion as _addCalendarQuestion, deleteCalendarQuestion as _deleteCalendarQuestion, updateCalendarBranding as _updateCalendarBranding } from "./question-actions";

async function addCalendarQuestion(formData: FormData) { "use server"; await _addCalendarQuestion(formData); }
async function deleteCalendarQuestion(formData: FormData) { "use server"; await _deleteCalendarQuestion(formData); }
async function updateCalendarBranding(formData: FormData) { "use server"; await _updateCalendarBranding(formData); }

type Props = { params: Promise<{ id: string }> };

type CalendarDetail = Prisma.CalendarGetPayload<{
  include: {
    appointments: { orderBy: { startsAt: "asc" }; include: { contact: true } };
    questions: { orderBy: { order: "asc" } };
  };
}>;

const QUESTION_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  email: "Email",
  phone: "Phone",
  textarea: "Textarea",
  select: "Select",
  checkbox: "Checkbox",
};

export default async function CalendarDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  let calendar: CalendarDetail | null = null;
  let contacts: Array<{ id: string; firstName: string; lastName: string | null; email: string | null }> = [];

  try {
    [calendar, contacts] = await Promise.all([
      prisma.calendar.findFirst({
        where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
        include: {
          appointments: { orderBy: { startsAt: "asc" }, include: { contact: true } },
          questions: { orderBy: { order: "asc" } },
        },
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
                        {/* Custom answers */}
                        {apt.customAnswers &&
                          typeof apt.customAnswers === "object" &&
                          Object.keys(apt.customAnswers).length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {calendar.questions
                                .filter((q) => (apt.customAnswers as Record<string, unknown>)[q.id] !== undefined)
                                .map((q) => {
                                  const val = (apt.customAnswers as Record<string, unknown>)[q.id];
                                  const display =
                                    typeof val === "boolean"
                                      ? val
                                        ? "Yes"
                                        : "No"
                                      : String(val ?? "");
                                  return (
                                    <p key={q.id} className="text-xs text-muted">
                                      <span className="font-medium text-foreground">{q.label}:</span>{" "}
                                      {display}
                                    </p>
                                  );
                                })}
                            </div>
                          )}
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

          {/* Custom Questions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="text-primary" size={18} />
                <h2 className="font-semibold">Custom Questions</h2>
                <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
                  {calendar.questions.length}
                </span>
              </div>
            </CardHeader>
            <CardBody>
              {/* Existing questions */}
              {calendar.questions.length > 0 && (
                <div className="mb-4 divide-y divide-border rounded-lg border border-border">
                  {calendar.questions.map((q) => (
                    <div key={q.id} className="flex items-center gap-3 px-3 py-2.5">
                      <GripVertical size={14} className="shrink-0 text-muted/50" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {q.label}
                          {q.required && <span className="ml-1 text-red-500">*</span>}
                        </p>
                        {q.type === "select" && q.options.length > 0 && (
                          <p className="truncate text-xs text-muted">{q.options.join(", ")}</p>
                        )}
                      </div>
                      <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                      </span>
                      <form action={deleteCalendarQuestion}>
                        <input name="questionId" type="hidden" value={q.id} />
                        <SubmitButton
                          className="rounded p-1 text-muted hover:text-red-600 transition"
                          pendingText="…"
                        >
                          <Trash2 size={14} />
                        </SubmitButton>
                      </form>
                    </div>
                  ))}
                </div>
              )}

              {/* Add question form */}
              <form action={addCalendarQuestion} className="space-y-3">
                <input name="calendarId" type="hidden" value={calendar.id} />
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Add a question</p>
                <Field label="Label" name="label" placeholder="e.g. What is your company size?" required />
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Type
                    </span>
                    <select
                      name="type"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select</option>
                      <option value="checkbox">Checkbox</option>
                    </select>
                  </label>
                  <label className="flex items-end gap-2 pb-2">
                    <input
                      type="checkbox"
                      name="required"
                      id="q-required"
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm font-medium">Required</span>
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Options <span className="font-normal normal-case">(for Select type, comma-separated)</span>
                  </span>
                  <input
                    type="text"
                    name="options"
                    placeholder="Option A, Option B, Option C"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                  />
                </label>
                <SubmitButton
                  className="rounded-md border border-border px-4 py-1.5 text-sm font-medium hover:bg-background transition"
                  pendingText="Adding…"
                >
                  Add Question
                </SubmitButton>
              </form>
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

          {/* Branding */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarDays className="text-primary" size={18} />
                <h2 className="font-semibold">Branding</h2>
              </div>
            </CardHeader>
            <CardBody>
              <form action={updateCalendarBranding} className="space-y-4">
                <input name="calendarId" type="hidden" value={calendar.id} />

                {/* Logo URL */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Logo URL
                  </span>
                  <input
                    type="url"
                    name="logoUrl"
                    defaultValue={calendar.logoUrl ?? ""}
                    placeholder="https://example.com/logo.png"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                  />
                  {calendar.logoUrl && (
                    <div className="mt-2 flex items-center justify-center rounded-md border border-border bg-background/50 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={calendar.logoUrl}
                        alt="Logo preview"
                        className="max-h-16 object-contain"
                      />
                    </div>
                  )}
                </label>

                {/* Brand Color */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                    Brand Color
                  </span>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      name="primaryColor"
                      defaultValue={calendar.primaryColor ?? "#0e7490"}
                      className="h-9 w-14 cursor-pointer rounded-md border border-border bg-background p-0.5"
                    />
                    <div
                      className="h-9 w-9 rounded-md border border-border shadow-sm"
                      style={{ backgroundColor: calendar.primaryColor ?? "#0e7490" }}
                    />
                    <span className="text-sm text-muted font-mono">{calendar.primaryColor ?? "#0e7490"}</span>
                  </div>
                </label>

                <SubmitButton
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                  pendingText="Saving…"
                >
                  Save Branding
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
