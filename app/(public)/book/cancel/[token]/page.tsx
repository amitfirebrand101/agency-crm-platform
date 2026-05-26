import { prisma } from "@/lib/prisma";
import { CalendarDays, Clock, MapPin, Video, XCircle, CheckCircle2, AlertCircle } from "lucide-react";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cancelled?: string }>;
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

export default async function CancelAppointmentPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { cancelled } = await searchParams;

  const appointment = await prisma.appointment.findUnique({
    where: { cancelToken: token },
    include: { calendar: true },
  });

  // ─── Error states ───────────────────────────────────────────────────────────

  if (!appointment) {
    return (
      <PageShell>
        <ErrorCard
          icon={<AlertCircle className="mx-auto mb-4 text-amber-400" size={48} />}
          title="Appointment not found"
          message="This cancellation link is invalid or has expired. Please check your confirmation email for the correct link."
        />
      </PageShell>
    );
  }

  if (appointment.status === "cancelled") {
    return (
      <PageShell>
        <ErrorCard
          icon={<XCircle className="mx-auto mb-4 text-slate-400" size={48} />}
          title="Already cancelled"
          message="This appointment has already been cancelled."
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
          title="Cannot cancel this appointment"
          message="This appointment is in the past and can no longer be cancelled."
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

  // ─── Success state ───────────────────────────────────────────────────────────

  if (cancelled === "1") {
    return (
      <PageShell>
        <div className="rounded-2xl border border-emerald-200 bg-white p-10 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={56} />
          <h2 className="text-2xl font-bold text-gray-900">Appointment cancelled</h2>
          <p className="mt-2 text-gray-600">
            Your appointment has been successfully cancelled.
          </p>
          <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 text-sm text-gray-700 text-left space-y-1">
            <p className="font-semibold text-gray-900 mb-2">{appointment.title}</p>
            <p className="text-gray-500 line-through">{formattedStart}</p>
          </div>
        </div>
      </PageShell>
    );
  }

  // ─── Confirmation form ───────────────────────────────────────────────────────

  return (
    <PageShell>
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Cancel appointment</h2>
        <p className="mt-1 text-sm text-gray-500">
          Are you sure you want to cancel the following appointment?
        </p>

        {/* Appointment details */}
        <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 space-y-3">
          <p className="font-semibold text-gray-900">{appointment.title}</p>

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

        {/* Cancel form */}
        <form method="POST" action={`/api/book/cancel/${token}`} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 active:bg-red-800 transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Cancel appointment
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          This action cannot be undone. To reschedule instead, please contact us directly.
        </p>
      </div>
    </PageShell>
  );
}

// ─── Shared layout components ────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-lg px-4 py-12">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight text-gray-900">Agency CRM</span>
        </div>
        {children}
      </div>
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
