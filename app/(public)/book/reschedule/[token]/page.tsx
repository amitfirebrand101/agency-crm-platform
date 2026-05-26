import { prisma } from "@/lib/prisma";
import { getSlotsForDay } from "@/lib/booking";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Video,
  XCircle,
} from "lucide-react";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string; rescheduled?: string }>;
};

function formatDateTime(date: Date, timezone: string) {
  return date.toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default async function RescheduleAppointmentPage({
  params,
  searchParams,
}: Props) {
  const { token } = await params;
  const { date: dateParam, rescheduled } = await searchParams;

  const appointment = await prisma.appointment.findUnique({
    where: { rescheduleToken: token },
    include: {
      calendar: {
        include: { availability: true },
      },
    },
  });

  // ─── Error states ───────────────────────────────────────────────────────────

  if (!appointment) {
    return (
      <PageShell>
        <ErrorCard
          icon={<AlertCircle className="mx-auto mb-4 text-amber-400" size={48} />}
          title="Link not found"
          message="This reschedule link is invalid or has expired. Please check your confirmation email for the correct link."
        />
      </PageShell>
    );
  }

  if (appointment.status === "cancelled") {
    return (
      <PageShell>
        <ErrorCard
          icon={<XCircle className="mx-auto mb-4 text-red-400" size={48} />}
          title="Cannot reschedule a cancelled appointment"
          message="This appointment has been cancelled and can no longer be rescheduled. Please book a new appointment."
        />
      </PageShell>
    );
  }

  const now = new Date();
  const isPast =
    appointment.startsAt < now ||
    appointment.status === "completed" ||
    appointment.status === "no_show";

  if (isPast) {
    return (
      <PageShell>
        <ErrorCard
          icon={<AlertCircle className="mx-auto mb-4 text-amber-400" size={48} />}
          title="Cannot reschedule a past appointment"
          message="This appointment has already passed and can no longer be rescheduled."
        />
      </PageShell>
    );
  }

  const { calendar } = appointment;
  const formattedStart = formatDateTime(appointment.startsAt, calendar.timezone);
  const formattedEnd = appointment.endsAt.toLocaleString("en-US", {
    timeZone: calendar.timezone,
    hour: "2-digit",
    minute: "2-digit",
  });

  // ─── Success state (rescheduled=1) ──────────────────────────────────────────

  if (rescheduled === "1") {
    return (
      <PageShell>
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={56} />
            <h2 className="text-2xl font-bold text-gray-900">
              Your appointment has been rescheduled!
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Your appointment has been moved to the new time shown below.
            </p>
          </div>
          <AppointmentDetails
            title={appointment.title}
            formattedStart={formattedStart}
            formattedEnd={formattedEnd}
            calendar={calendar}
          />
        </div>
      </PageShell>
    );
  }

  // ─── Fetch available slots for the chosen date ──────────────────────────────

  const today = new Date().toISOString().slice(0, 10);
  const selectedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : null;

  let slots: Awaited<ReturnType<typeof getSlotsForDay>> = [];

  if (selectedDate && selectedDate >= today) {
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        calendarId: calendar.id,
        // Exclude the current appointment so it doesn't block its own slot
        id: { not: appointment.id },
        startsAt: {
          gte: new Date(`${selectedDate}T00:00:00`),
          lt: new Date(`${selectedDate}T23:59:59`),
        },
      },
      select: { startsAt: true, endsAt: true, status: true },
    });

    slots = getSlotsForDay(
      selectedDate,
      calendar,
      calendar.availability,
      existingAppointments
    );
  }

  const formattedSelectedDate = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // ─── Reschedule flow ─────────────────────────────────────────────────────────

  return (
    <PageShell>
      <div className="space-y-6">
        {/* Current appointment details */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold text-gray-900">Reschedule appointment</h2>
          <p className="mb-5 text-sm text-gray-500">
            Your current appointment is shown below. Choose a new time to reschedule it.
          </p>
          <AppointmentDetails
            title={appointment.title}
            formattedStart={formattedStart}
            formattedEnd={formattedEnd}
            calendar={calendar}
          />
        </div>

        {/* Date picker */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Choose a new time below</h3>

          <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="token" value={token} />
            <label className="flex-1 block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Select date
              </span>
              <input
                type="date"
                name="date"
                defaultValue={selectedDate ?? ""}
                min={today}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </label>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Show available times
            </button>
          </form>
        </div>

        {/* Slot grid — rendered after a date is chosen */}
        {selectedDate && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {formattedSelectedDate && (
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                <CalendarDays size={14} className="shrink-0 text-gray-400" />
                <span className="font-semibold text-gray-900">{formattedSelectedDate}</span>
              </div>
            )}

            {slots.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">
                No available slots on this day. Please pick another date.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((slot) => (
                  <form
                    key={slot.start}
                    method="POST"
                    action={`/api/book/reschedule/${token}`}
                  >
                    <input type="hidden" name="newStartsAt" value={slot.start} />
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-900 hover:border-blue-500 hover:bg-blue-50 transition"
                    >
                      {slot.label}
                    </button>
                  </form>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}

// ─── Shared layout components ─────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-gray-900">Agency CRM</span>
        </div>
        {children}
      </div>
    </div>
  );
}

type CalendarShape = {
  name: string;
  location: string | null;
  conferenceUrl: string | null;
};

function AppointmentDetails({
  title,
  formattedStart,
  formattedEnd,
  calendar,
}: {
  title: string;
  formattedStart: string;
  formattedEnd: string;
  calendar: CalendarShape;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 space-y-3">
      <p className="font-semibold text-gray-900">{title}</p>

      <div className="flex items-start gap-2 text-sm text-gray-600">
        <CalendarDays size={15} className="mt-0.5 shrink-0 text-gray-400" />
        <span>{formattedStart}</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Clock size={15} className="shrink-0 text-gray-400" />
        <span>Until {formattedEnd}</span>
      </div>

      {calendar.location && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin size={15} className="shrink-0 text-gray-400" />
          <span>{calendar.location}</span>
        </div>
      )}

      {calendar.conferenceUrl && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Video size={15} className="shrink-0 text-gray-400" />
          <a
            href={calendar.conferenceUrl}
            className="text-blue-600 hover:underline truncate"
            target="_blank"
            rel="noopener noreferrer"
          >
            Video call link
          </a>
        </div>
      )}

      <p className="text-xs text-gray-400 pt-1">Calendar: {calendar.name}</p>
    </div>
  );
}

function ErrorCard({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
      {icon}
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
    </div>
  );
}
