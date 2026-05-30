"use client";

import { useState, useTransition } from "react";

export type AvailableDay = {
  date: string;   // "2024-01-15"
  label: string;  // "Mon, Jan 15"
  slots: string[]; // ISO datetime strings
};

export type Question = {
  id: string;
  label: string;
  type: string;
  options: string[];
  required: boolean;
};

export type BookingFormProps = {
  calendarId: string;
  calendarName: string;
  slotDuration: number;
  primaryColor: string;
  availableDays: AvailableDay[];
  questions: Question[];
  bookAction: (formData: FormData) => Promise<{ error?: string }>;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

export function BookingForm({
  calendarId,
  calendarName,
  slotDuration,
  primaryColor,
  availableDays,
  questions,
  bookAction,
}: BookingFormProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(
    availableDays[0]?.date ?? null
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedDay = availableDays.find((d) => d.date === selectedDate) ?? null;

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setError(null);
  }

  function handleSlotSelect(slot: string) {
    setSelectedSlot(slot);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSlot) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await bookAction(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setSubmitted(true);
      }
    });
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: `${primaryColor}20` }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke={primaryColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-7 w-7"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Appointment booked!</h2>
        <p className="mt-2 text-sm text-muted">
          Your appointment is confirmed. You&apos;ll receive a confirmation shortly.
        </p>
        {selectedSlot && (
          <p className="mt-4 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium">
            {new Date(selectedSlot).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
            {" at "}
            {formatTime(selectedSlot)}
          </p>
        )}
      </div>
    );
  }

  if (availableDays.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
        <p className="font-medium">No available slots</p>
        <p className="mt-1 text-sm text-muted">
          There are no open time slots in the coming days. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1 — Pick a date */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Step 1 — Select a date
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {availableDays.map((day) => {
            const isSelected = day.date === selectedDate;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => handleDateSelect(day.date)}
                className="flex shrink-0 flex-col items-center rounded-lg border px-4 py-3 text-sm transition focus:outline-none focus:ring-2"
                style={
                  isSelected
                    ? {
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                        color: "#fff",
                        boxShadow: `0 0 0 2px ${primaryColor}40`,
                      }
                    : undefined
                }
                data-selected={isSelected ? "true" : undefined}
              >
                <span className={`font-semibold ${!isSelected ? "text-foreground" : ""}`}>
                  {day.label.split(",")[0]}
                </span>
                <span className={`mt-0.5 text-xs ${isSelected ? "opacity-90" : "text-muted"}`}>
                  {day.label.split(",").slice(1).join(",").trim()}
                </span>
                <span
                  className={`mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    isSelected ? "bg-white/20 text-white" : "bg-background text-muted"
                  }`}
                >
                  {day.slots.length} slot{day.slots.length !== 1 ? "s" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 — Pick a time */}
      {selectedDay && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Step 2 — Select a time
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedDay.slots.map((slot) => {
              const isSelected = slot === selectedSlot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleSlotSelect(slot)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2"
                  style={
                    isSelected
                      ? {
                          backgroundColor: primaryColor,
                          borderColor: primaryColor,
                          color: "#fff",
                        }
                      : undefined
                  }
                >
                  {formatTime(slot)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 3 — Your info */}
      {selectedSlot && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
            Step 3 — Your information
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Hidden fields */}
            <input type="hidden" name="calendarId" value={calendarId} />
            <input type="hidden" name="startsAt" value={selectedSlot} />
            <input type="hidden" name="endsAt" value={addMinutes(selectedSlot, slotDuration)} />

            {/* Core fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  First name <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  name="firstName"
                  required
                  autoComplete="given-name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring-4"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Last name
                </span>
                <input
                  type="text"
                  name="lastName"
                  autoComplete="family-name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring-4"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Email <span className="text-red-500">*</span>
              </span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring-4"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Phone
              </span>
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring-4"
              />
            </label>

            {/* Custom questions */}
            {questions.length > 0 && (
              <div className="space-y-4 border-t border-border pt-4">
                {questions.map((q) => (
                  <label key={q.id} className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                      {q.label}
                      {q.required && <span className="ml-1 text-red-500">*</span>}
                    </span>
                    {q.type === "select" ? (
                      <select
                        name={`q_${q.id}`}
                        required={q.required}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring-4"
                      >
                        <option value="">Select an option</option>
                        {q.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : q.type === "textarea" ? (
                      <textarea
                        name={`q_${q.id}`}
                        required={q.required}
                        rows={3}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring-4"
                      />
                    ) : (
                      <input
                        type={
                          q.type === "email"
                            ? "email"
                            : q.type === "phone"
                            ? "tel"
                            : "text"
                        }
                        name={`q_${q.id}`}
                        required={q.required}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none ring-primary/20 focus:ring-4"
                      />
                    )}
                  </label>
                ))}
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: primaryColor }}
            >
              {isPending ? "Booking…" : "Confirm Booking"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
