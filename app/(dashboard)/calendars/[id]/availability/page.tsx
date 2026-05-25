"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowLeft, Clock, Globe, Link as LinkIcon, Save } from "lucide-react";
import Link from "next/link";
import { saveAvailability } from "./actions";

type Props = { params: Promise<{ id: string }> };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_WINDOWS = DAYS.map((_, i) => ({
  dayOfWeek: i,
  startTime: "09:00",
  endTime: "17:00",
  isEnabled: i >= 1 && i <= 5, // Mon–Fri
}));

export default function CalendarAvailabilityPage({ params }: Props) {
  const [calendarId, setCalendarId] = useState<string>("");
  const [calendar, setCalendar] = useState<{
    name: string;
    timezone: string;
    slotDuration: number;
    bufferBefore: number;
    bufferAfter: number;
    minNotice: number;
    maxDaysAhead: number;
    bookingPageSlug: string | null;
    confirmationEmailEnabled: boolean;
    reminderEmailEnabled: boolean;
    reminderEmailHours: number;
    reminderSmsEnabled: boolean;
    reminderSmsHours: number;
    description: string | null;
    location: string | null;
    conferenceUrl: string | null;
    availability: Array<{ dayOfWeek: number; startTime: string; endTime: string; isEnabled: boolean }>;
  } | null>(null);

  const [windows, setWindows] = useState(DEFAULT_WINDOWS);
  const [loading, setLoading] = useState(true);
  const [state, formAction, pending] = useActionState(saveAvailability, null);

  useEffect(() => {
    params.then((p) => {
      setCalendarId(p.id);
      fetch(`/api/calendars/${p.id}/availability`)
        .then((r) => r.json())
        .then((data) => {
          setCalendar(data);
          if (data.availability?.length) {
            setWindows(
              DAYS.map((_, i) => {
                const saved = data.availability.find((a: { dayOfWeek: number }) => a.dayOfWeek === i);
                return saved ?? { dayOfWeek: i, startTime: "09:00", endTime: "17:00", isEnabled: false };
              })
            );
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    });
  }, [params]);

  function toggleDay(idx: number) {
    setWindows((prev) => prev.map((w, i) => (i === idx ? { ...w, isEnabled: !w.isEnabled } : w)));
  }
  function setTime(idx: number, field: "startTime" | "endTime", val: string) {
    setWindows((prev) => prev.map((w, i) => (i === idx ? { ...w, [field]: val } : w)));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted">Loading availability settings…</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/calendars/${calendarId}`}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft size={15} />
          Back to calendar
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Availability Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Configure when contacts can book appointments on{" "}
          <strong>{calendar?.name ?? "this calendar"}</strong>.
        </p>
      </div>

      {state?.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Availability saved.
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="calendarId" value={calendarId} />

        {/* Availability windows */}
        <div className="rounded-xl border border-border bg-panel shadow-soft">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Clock className="text-primary" size={17} />
            <h2 className="font-semibold">Weekly Availability</h2>
          </div>
          <div className="divide-y divide-border">
            {windows.map((w, idx) => (
              <div key={idx} className="flex items-center gap-4 px-5 py-3.5">
                <label className="flex w-32 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-primary"
                    checked={w.isEnabled}
                    onChange={() => toggleDay(idx)}
                    name={`day_${idx}_enabled`}
                  />
                  <span className={`text-sm font-medium ${w.isEnabled ? "text-foreground" : "text-muted"}`}>
                    {DAYS[idx]}
                  </span>
                </label>
                {w.isEnabled ? (
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      name={`day_${idx}_start`}
                      value={w.startTime}
                      onChange={(e) => setTime(idx, "startTime", e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-primary/20 focus:ring-4"
                    />
                    <span className="text-muted">to</span>
                    <input
                      type="time"
                      name={`day_${idx}_end`}
                      value={w.endTime}
                      onChange={(e) => setTime(idx, "endTime", e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-primary/20 focus:ring-4"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted">Unavailable</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Slot settings */}
        <div className="rounded-xl border border-border bg-panel shadow-soft">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Clock className="text-primary" size={17} />
            <h2 className="font-semibold">Slot Settings</h2>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Slot Duration (minutes)
              </span>
              <select
                name="slotDuration"
                defaultValue={calendar?.slotDuration ?? 30}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              >
                {[15, 20, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Buffer Before (minutes)
              </span>
              <select
                name="bufferBefore"
                defaultValue={calendar?.bufferBefore ?? 0}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              >
                {[0, 5, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Buffer After (minutes)
              </span>
              <select
                name="bufferAfter"
                defaultValue={calendar?.bufferAfter ?? 0}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              >
                {[0, 5, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Minimum Notice
              </span>
              <select
                name="minNotice"
                defaultValue={calendar?.minNotice ?? 60}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              >
                <option value={0}>None</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={240}>4 hours</option>
                <option value={480}>8 hours</option>
                <option value={1440}>1 day</option>
                <option value={2880}>2 days</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Maximum Days Ahead
              </span>
              <select
                name="maxDaysAhead"
                defaultValue={calendar?.maxDaysAhead ?? 60}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              >
                {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Timezone
              </span>
              <select
                name="timezone"
                defaultValue={calendar?.timezone ?? "America/New_York"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              >
                {[
                  "America/New_York",
                  "America/Chicago",
                  "America/Denver",
                  "America/Los_Angeles",
                  "America/Phoenix",
                  "America/Anchorage",
                  "Pacific/Honolulu",
                  "Europe/London",
                  "Europe/Paris",
                  "Europe/Berlin",
                  "Asia/Dubai",
                  "Asia/Kolkata",
                  "Asia/Tokyo",
                  "Australia/Sydney",
                ].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Location + meeting URL */}
        <div className="rounded-xl border border-border bg-panel shadow-soft">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Globe className="text-primary" size={17} />
            <h2 className="font-semibold">Location &amp; Meeting</h2>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Physical Location
              </span>
              <input
                name="location"
                defaultValue={calendar?.location ?? ""}
                placeholder="123 Main St, New York, NY"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Conference URL (Zoom / Meet)
              </span>
              <input
                name="conferenceUrl"
                type="url"
                defaultValue={calendar?.conferenceUrl ?? ""}
                placeholder="https://zoom.us/j/..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Calendar Description (shown on booking page)
              </span>
              <textarea
                name="description"
                defaultValue={calendar?.description ?? ""}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
              />
            </label>
          </div>
        </div>

        {/* Booking page */}
        <div className="rounded-xl border border-border bg-panel shadow-soft">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <LinkIcon className="text-primary" size={17} />
            <h2 className="font-semibold">Booking Page</h2>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                Custom Slug (e.g. &ldquo;discovery-call&rdquo;)
              </span>
              <div className="flex items-center rounded-md border border-border bg-background overflow-hidden">
                <span className="border-r border-border bg-background/60 px-3 py-2 text-sm text-muted select-none whitespace-nowrap">
                  /book/
                </span>
                <input
                  name="bookingPageSlug"
                  defaultValue={calendar?.bookingPageSlug ?? ""}
                  placeholder={calendarId}
                  pattern="[a-z0-9-]+"
                  className="flex-1 bg-transparent px-3 py-2 text-sm outline-none ring-inset ring-primary/20 focus:ring-4"
                />
              </div>
              <p className="mt-1 text-xs text-muted">Lowercase letters, numbers, and hyphens only.</p>
            </label>

            <div className="sm:col-span-2 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="confirmationEmailEnabled"
                  defaultChecked={calendar?.confirmationEmailEnabled ?? true}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">Send confirmation email</p>
                  <p className="text-xs text-muted">Sends an email to the contact when they book.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="reminderEmailEnabled"
                  defaultChecked={calendar?.reminderEmailEnabled ?? false}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">Send reminder email</p>
                  <p className="text-xs text-muted">Reminder sent before the appointment.</p>
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                  Reminder hours before
                </span>
                <select
                  name="reminderEmailHours"
                  defaultValue={calendar?.reminderEmailHours ?? 24}
                  className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/20 focus:ring-4"
                >
                  {[1, 2, 4, 12, 24, 48].map((h) => (
                    <option key={h} value={h}>{h}h before</option>
                  ))}
                </select>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="reminderSmsEnabled"
                  defaultChecked={calendar?.reminderSmsEnabled ?? false}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">Send reminder SMS</p>
                  <p className="text-xs text-muted">Requires Twilio to be configured.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
          >
            <Save size={15} />
            {pending ? "Saving…" : "Save availability"}
          </button>
        </div>
      </form>
    </div>
  );
}
