"use client";

import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, MapPin, Video } from "lucide-react";
import { TimezoneDisplay } from "./timezone-display";

type CalendarInfo = {
  id: string;
  name: string;
  description: string | null;
  timezone: string;
  slotDuration: number;
  location: string | null;
  conferenceUrl: string | null;
};

type Slot = { start: string; end: string; label: string };

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT_DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getAvailableDaysFromSlots(year: number, month: number, slots: Record<string, Slot[]>) {
  return Object.keys(slots).filter((d) => {
    const [y, m] = d.split("-").map(Number);
    return y === year && m === month + 1 && (slots[d]?.length ?? 0) > 0;
  });
}

export default function BookingPage({ params }: { params: Promise<{ calendarId: string }> }) {
  const [calendarId, setCalendarId] = useState("");
  const [calendarInfo, setCalendarInfo] = useState<CalendarInfo | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [step, setStep] = useState<"calendar" | "slots" | "form" | "confirmed">("calendar");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedAt, setBookedAt] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => {
      setCalendarId(p.calendarId);
      // Fetch calendar info via the book API
      fetch(`/api/book/${p.calendarId}?date=${new Date().toISOString().slice(0, 10)}`)
        .then((r) => r.json())
        .then(() => {
          // Fetch calendar metadata from a public info endpoint
          fetch(`/api/book/${p.calendarId}/info`)
            .then((r) => r.json())
            .then(setCalendarInfo)
            .catch(console.error);
        });
    });
  }, [params]);

  async function loadSlots(dateStr: string) {
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const r = await fetch(`/api/book/${calendarId}?date=${dateStr}`);
      const data = await r.json();
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function selectDate(dateStr: string) {
    setSelectedDate(dateStr);
    setStep("slots");
    loadSlots(dateStr);
  }

  async function handleBook() {
    if (!selectedSlot || !selectedDate) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(`/api/book/${calendarId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startsAt: selectedSlot.start,
          endsAt: selectedSlot.end,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Booking failed."); return; }
      setBookedAt(selectedSlot.start);
      setStep("confirmed");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Calendar grid helpers
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else { setMonth(m => m - 1); } }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else { setMonth(m => m + 1); } }

  function dayStr(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const formattedSlotDate = selectedDate
    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  const formattedBookedDate = bookedAt
    ? new Date(bookedAt).toLocaleString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZoneName: "short",
      })
    : "";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          {calendarInfo ? (
            <>
              <h1 className="text-3xl font-bold text-gray-900">{calendarInfo.name}</h1>
              {calendarInfo.description && (
                <p className="mt-2 text-gray-600">{calendarInfo.description}</p>
              )}
              <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} /> {calendarInfo.slotDuration} min
                </span>
                {calendarInfo.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} /> {calendarInfo.location}
                  </span>
                )}
                {calendarInfo.conferenceUrl && (
                  <span className="flex items-center gap-1.5">
                    <Video size={14} /> Video call
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="h-10 animate-pulse rounded-lg bg-gray-200" />
          )}
        </div>

        {/* Confirmed state */}
        {step === "confirmed" && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-10 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={56} />
            <h2 className="text-2xl font-bold text-gray-900">You&apos;re booked!</h2>
            <p className="mt-2 text-gray-600">
              Your appointment has been confirmed for<br />
              <strong>{formattedBookedDate}</strong>
            </p>
            <p className="mt-4 text-sm text-gray-500">A confirmation email has been sent to {form.email}.</p>
          </div>
        )}

        {/* Calendar step */}
        {step === "calendar" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <button onClick={prevMonth} className="rounded-lg p-2 hover:bg-gray-100 transition">
                <ChevronLeft size={18} />
              </button>
              <h2 className="text-lg font-semibold text-gray-900">
                {MONTHS[month]} {year}
              </h2>
              <button onClick={nextMonth} className="rounded-lg p-2 hover:bg-gray-100 transition">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-gray-500">
              {SHORT_DAYS.map((d) => <div key={d}>{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const ds = dayStr(d);
                const isPast = ds < today;
                return (
                  <button
                    key={d}
                    disabled={isPast}
                    onClick={() => !isPast && selectDate(ds)}
                    className={[
                      "aspect-square w-full rounded-lg text-sm font-medium transition",
                      isPast ? "cursor-not-allowed text-gray-300" :
                      ds === selectedDate ? "bg-blue-600 text-white" :
                      "hover:bg-blue-50 text-gray-900",
                    ].join(" ")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Slots step */}
        {step === "slots" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("calendar")}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition"
              >
                <ChevronLeft size={15} /> Back
              </button>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar size={14} />
                <span className="font-semibold text-gray-900">{formattedSlotDate}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-1 font-semibold text-gray-900">Select a time</h2>
              <TimezoneDisplay />
              <div className="mt-4">
                {loadingSlots ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-blue-500" size={28} />
                  </div>
                ) : slots.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    No available slots on this day. Please pick another date.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((s) => (
                      <button
                        key={s.start}
                        onClick={() => { setSelectedSlot(s); setStep("form"); }}
                        className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-900 hover:border-blue-500 hover:bg-blue-50 transition"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Form step */}
        {step === "form" && selectedSlot && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("slots")}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition"
              >
                <ChevronLeft size={15} /> Back
              </button>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-gray-900">
                  <Calendar size={14} /> {formattedSlotDate}
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-blue-600">
                  <Clock size={14} /> {selectedSlot.label}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 font-semibold text-gray-900">Enter your details</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">First name *</span>
                    <input
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Last name</span>
                    <input
                      value={form.lastName}
                      onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Email *</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Notes (optional)</span>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-none"
                  />
                </label>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleBook}
                  disabled={submitting || !form.firstName || !form.email}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting && <Loader2 className="animate-spin" size={15} />}
                  {submitting ? "Confirming…" : "Confirm Appointment"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
