import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { bookAppointment } from "./actions";
import { BookingForm, type AvailableDay, type Question } from "./booking-form";

// ── Slot helpers ─────────────────────────────────────────────────────────────

function generateSlots(
  date: Date,
  startTime: string,
  endTime: string,
  slotDuration: number,
  bufferBefore: number,
  bufferAfter: number
): Date[] {
  const slots: Date[] = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);

  const current = new Date(date);
  current.setHours(sh, sm, 0, 0);

  const end = new Date(date);
  end.setHours(eh, em, 0, 0);

  while (current < end) {
    const slotEnd = new Date(current.getTime() + slotDuration * 60000);
    if (slotEnd <= end) {
      slots.push(new Date(current));
    }
    current.setTime(current.getTime() + (slotDuration + bufferBefore + bufferAfter) * 60000);
  }
  return slots;
}

function isSlotTaken(
  slotStart: Date,
  slotEnd: Date,
  appointments: Array<{ startsAt: Date; endsAt: Date }>
): boolean {
  return appointments.some(
    (apt) => apt.startsAt < slotEnd && apt.endsAt > slotStart
  );
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const calendar = await prisma.calendar.findFirst({
    where: { bookingPageSlug: slug },
    select: { name: true, description: true },
  });
  if (!calendar) return { title: "Booking page not found" };
  return {
    title: `Book a time — ${calendar.name}`,
    description: calendar.description ?? undefined,
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ slug: string }> };

export default async function BookingPage({ params }: Props) {
  const { slug } = await params;

  // Fetch calendar with availability, questions, and upcoming non-cancelled appointments
  const calendar = await prisma.calendar.findFirst({
    where: { bookingPageSlug: slug },
    include: {
      availability: true,
      questions: { orderBy: { order: "asc" } },
      appointments: {
        where: {
          status: { notIn: ["cancelled", "no_show"] },
          startsAt: { gte: new Date() },
        },
        select: { startsAt: true, endsAt: true },
      },
    },
  });

  if (!calendar) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm rounded-xl border border-border bg-card p-10 text-center shadow-sm">
          <p className="text-lg font-semibold">Page not found</p>
          <p className="mt-2 text-sm text-muted">This booking page does not exist.</p>
        </div>
      </div>
    );
  }

  // ── Compute available slots ───────────────────────────────────────────────

  const now = new Date();
  const minNoticeMs = calendar.minNotice * 60 * 1000;
  const earliestAllowed = new Date(now.getTime() + minNoticeMs);

  const availableDays: AvailableDay[] = [];

  for (let i = 1; i <= calendar.maxDaysAhead; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    // Normalise to midnight local time — slots will be set to local hours
    day.setHours(0, 0, 0, 0);

    const dayOfWeek = day.getDay(); // 0 = Sunday

    const avail = calendar.availability.find(
      (a) => a.dayOfWeek === dayOfWeek && a.isEnabled
    );
    if (!avail) continue;

    const rawSlots = generateSlots(
      day,
      avail.startTime,
      avail.endTime,
      calendar.slotDuration,
      calendar.bufferBefore,
      calendar.bufferAfter
    );

    const openSlots = rawSlots.filter((slotStart) => {
      // Must be after now + minNotice
      if (slotStart < earliestAllowed) return false;

      const slotEnd = new Date(slotStart.getTime() + calendar.slotDuration * 60000);

      // Must not overlap any existing appointment
      const aptList = calendar.appointments.map((a) => ({
        startsAt: new Date(a.startsAt),
        endsAt: new Date(a.endsAt),
      }));
      if (isSlotTaken(slotStart, slotEnd, aptList)) return false;

      return true;
    });

    if (openSlots.length === 0) continue;

    // Build a human-readable label for the date
    const label = day.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    availableDays.push({
      date: day.toISOString().slice(0, 10),
      label,
      slots: openSlots.map((s) => s.toISOString()),
    });
  }

  // ── Serialize questions ───────────────────────────────────────────────────

  const questions: Question[] = calendar.questions.map((q) => ({
    id: q.id,
    label: q.label,
    type: q.type,
    options: q.options,
    required: q.required,
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  const color = calendar.primaryColor || "#0e7490";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center text-center">
        {calendar.logoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={calendar.logoUrl}
            alt={`${calendar.name} logo`}
            className="mb-4 h-16 w-auto object-contain"
          />
        ) : (
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {calendar.name.charAt(0).toUpperCase()}
          </div>
        )}

        <h1 className="text-2xl font-bold">{calendar.name}</h1>

        {calendar.description && (
          <p className="mt-2 max-w-md text-sm text-muted">{calendar.description}</p>
        )}

        <p className="mt-2 text-xs text-muted">
          Times shown in your local timezone &mdash; calendar is set to{" "}
          <span className="font-medium text-foreground">{calendar.timezone}</span>
        </p>
      </div>

      {/* Booking form */}
      <BookingForm
        calendarId={calendar.id}
        calendarName={calendar.name}
        slotDuration={calendar.slotDuration}
        primaryColor={color}
        availableDays={availableDays}
        questions={questions}
        bookAction={bookAppointment}
      />
    </div>
  );
}
