import { prisma } from "@/lib/prisma";
import {
  CalendarDays,
  Clock,
  MapPin,
  Video,
  CheckCircle2,
  AlertCircle,
  XCircle,
  CalendarPlus,
} from "lucide-react";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ confirmed?: string }>;
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

/** Format a Date to `YYYYMMDDTHHmmssZ` for Google Calendar / ICS */
function toGCalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildGoogleCalendarUrl(opts: {
  title: string;
  startsAt: Date;
  endsAt: Date;
  description: string;
  location: string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${toGCalDate(opts.startsAt)}/${toGCalDate(opts.endsAt)}`,
    details: opts.description,
    location: opts.location,
  });
  return `https://www.google.com/calendar/render?${params.toString()}`;
}

export default async function ConfirmAppointmentPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { confirmed } = await searchParams;

  const appointment = await prisma.appointment.findUnique({
    where: { confirmToken: token },
    include: { calendar: true },
  });

  // ─── Error states ───────────────────────────────────────────────────────────

  if (!appointment) {
    return (
      <PageShell>
        <ErrorCard
          icon={<AlertCircle className="mx-auto mb-4 text-amber-400" size={48} />}
          title="Appointment not found"
          message="This confirmation link is invalid or has expired. Please check your confirmation email for the correct link."
        />
      </PageShell>
    );
  }

  if (appointment.status === "cancelled") {
    return (
      <PageShell>
        <ErrorCard
          icon={<XCircle className="mx-auto mb-4 text-red-400" size={48} />}
          title="Appointment was cancelled"
          message="This appointment has been cancelled and can no longer be confirmed."
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

  const locationStr = calendar.conferenceUrl ?? calendar.location ?? "";
  const descriptionStr = appointment.notes ?? calendar.name;

  const googleCalUrl = buildGoogleCalendarUrl({
    title: appointment.title,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    description: descriptionStr,
    location: locationStr,
  });

  const icsUrl = `/api/book/ics/${token}`;

  // ─── Already confirmed state ─────────────────────────────────────────────

  if (appointment.status === "confirmed" && confirmed !== "1") {
    return (
      <PageShell>
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
          <div className="mb-5 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={48} />
            <h2 className="text-xl font-bold text-gray-900">Already confirmed</h2>
            <p className="mt-1 text-sm text-gray-500">
              This appointment has already been confirmed.
            </p>
          </div>
          <AppointmentDetails
            title={appointment.title}
            formattedStart={formattedStart}
            formattedEnd={formattedEnd}
            calendar={calendar}
          />
          <AddToCalendarLinks googleCalUrl={googleCalUrl} icsUrl={icsUrl} />
        </div>
      </PageShell>
    );
  }

  // ─── Success state ────────────────────────────────────────────────────────

  if (confirmed === "1") {
    return (
      <PageShell>
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
          <div className="mb-6 text-center">
            <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={56} />
            <h2 className="text-2xl font-bold text-gray-900">You&apos;re confirmed!</h2>
            <p className="mt-2 text-gray-500 text-sm">
              Your appointment has been confirmed. We look forward to seeing you.
            </p>
          </div>

          <AppointmentDetails
            title={appointment.title}
            formattedStart={formattedStart}
            formattedEnd={formattedEnd}
            calendar={calendar}
          />

          <AddToCalendarLinks googleCalUrl={googleCalUrl} icsUrl={icsUrl} />
        </div>
      </PageShell>
    );
  }

  // ─── Confirmation form ────────────────────────────────────────────────────

  return (
    <PageShell>
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Confirm your appointment</h2>
        <p className="mt-1 text-sm text-gray-500">
          Please confirm that you&apos;ll be attending the following appointment.
        </p>

        <div className="mt-6">
          <AppointmentDetails
            title={appointment.title}
            formattedStart={formattedStart}
            formattedEnd={formattedEnd}
            calendar={calendar}
          />
        </div>

        <form method="POST" action={`/api/book/confirm/${token}`} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Confirm my appointment
          </button>
        </form>
      </div>
    </PageShell>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

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

function AddToCalendarLinks({
  googleCalUrl,
  icsUrl,
}: {
  googleCalUrl: string;
  icsUrl: string;
}) {
  return (
    <div className="mt-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Add to calendar
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={googleCalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          <CalendarPlus size={15} />
          Google Calendar
        </a>
        <a
          href={icsUrl}
          download="appointment.ics"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          <CalendarPlus size={15} />
          Download .ics
        </a>
      </div>
    </div>
  );
}

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

function ErrorCard({ icon, title, message }: { icon: React.ReactNode; title: string; message: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
      {icon}
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
    </div>
  );
}
