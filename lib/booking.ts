/**
 * Booking slot computation engine.
 *
 * Generates available 30/60/etc-minute slots for a given calendar on a given date,
 * accounting for: availability windows, buffer times, min notice, existing appointments.
 */

export interface AvailabilityWindow {
  dayOfWeek: number; // 0=Sun … 6=Sat
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  isEnabled: boolean;
}

export interface ExistingAppointment {
  startsAt: Date;
  endsAt: Date;
  status: string; // "cancelled" appointments don't block slots
}

export interface CalendarSettings {
  slotDuration: number;  // minutes
  bufferBefore: number;  // minutes
  bufferAfter: number;   // minutes
  minNotice: number;     // minutes ahead required to book
  maxDaysAhead: number;
  timezone: string;
}

export interface TimeSlot {
  start: string; // ISO string
  end: string;
  label: string; // "9:00 AM"
}

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function toMinutes(h: number, m: number) {
  return h * 60 + m;
}

export function getAvailableDays(
  settings: CalendarSettings,
  windows: AvailabilityWindow[],
  fromDate: Date,
  count = 30
): string[] {
  const result: string[] = [];
  const enabledDays = new Set(windows.filter((w) => w.isEnabled).map((w) => w.dayOfWeek));
  const now = new Date();
  const cur = new Date(fromDate);
  cur.setHours(0, 0, 0, 0);
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + settings.maxDaysAhead);

  let safety = 0;
  while (result.length < count && cur <= maxDate && safety < 365) {
    safety++;
    const dow = cur.getDay();
    if (enabledDays.has(dow)) {
      result.push(cur.toISOString().slice(0, 10));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

export function getSlotsForDay(
  dateStr: string, // "YYYY-MM-DD"
  settings: CalendarSettings,
  windows: AvailabilityWindow[],
  existingAppointments: ExistingAppointment[]
): TimeSlot[] {
  const [year, month, day] = dateStr.split("-").map(Number);
  const dow = new Date(year!, month! - 1, day!).getDay();
  const window = windows.find((w) => w.dayOfWeek === dow && w.isEnabled);
  if (!window) return [];

  const { h: startH, m: startM } = parseTime(window.startTime);
  const { h: endH, m: endM } = parseTime(window.endTime);
  const windowStart = toMinutes(startH, startM);
  const windowEnd = toMinutes(endH, endM);

  const slotDur = settings.slotDuration;
  const bufBefore = settings.bufferBefore;
  const bufAfter = settings.bufferAfter;
  const minNoticeMs = settings.minNotice * 60_000;

  // Build blocked intervals from non-cancelled appointments
  const blocked = existingAppointments
    .filter((a) => a.status !== "cancelled")
    .map((a) => {
      const s = new Date(a.startsAt);
      const e = new Date(a.endsAt);
      const slotDate = new Date(year!, month! - 1, day!);
      if (s.toDateString() !== slotDate.toDateString()) return null;
      const sMin = s.getHours() * 60 + s.getMinutes() - bufBefore;
      const eMin = e.getHours() * 60 + e.getMinutes() + bufAfter;
      return { start: sMin, end: eMin };
    })
    .filter(Boolean) as { start: number; end: number }[];

  const slots: TimeSlot[] = [];
  const now = Date.now();

  for (let cur = windowStart; cur + slotDur <= windowEnd; cur += slotDur) {
    // Check min notice
    const slotDate = new Date(year!, month! - 1, day!, Math.floor(cur / 60), cur % 60, 0, 0);
    if (slotDate.getTime() - now < minNoticeMs) continue;

    const slotEnd = cur + slotDur;
    const isBlocked = blocked.some((b) => cur < b.end && slotEnd > b.start);
    if (isBlocked) continue;

    const h = Math.floor(cur / 60);
    const m = cur % 60;
    const ampm = h < 12 ? "AM" : "PM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const label = `${displayH}:${String(m).padStart(2, "0")} ${ampm}`;

    slots.push({
      start: slotDate.toISOString(),
      end: new Date(slotDate.getTime() + slotDur * 60_000).toISOString(),
      label,
    });
  }

  return slots;
}
