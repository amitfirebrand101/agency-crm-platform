"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Appointment = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  contact: { id: string; firstName: string; lastName: string | null } | null;
};

type Props = {
  appointments: Appointment[];
  initialYear: number;
  initialMonth: number;
  onDayClick?: (dateStr: string) => void;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DOW_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDow(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isToday(year: number, month: number, day: number) {
  const t = new Date();
  return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isPast(year: number, month: number, day: number) {
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const cell = new Date(year, month, day);
  return cell < today;
}

const STATUS_PILL: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-gray-100 text-gray-700",
  no_show: "bg-amber-100 text-amber-700",
};

function pillClass(status: string) {
  return STATUS_PILL[status] ?? "bg-gray-100 text-gray-700";
}

export function MonthGrid({ appointments, initialYear, initialMonth, onDayClick }: Props) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDow = getFirstDow(year, month);

  // Build flat cell array: nulls for leading empty cells, then day numbers
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // Pad to complete last row
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) cells.push(null);
  }

  function getAppointmentsForDay(day: number) {
    return appointments.filter((apt) => {
      const d = new Date(apt.startsAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  return (
    <div className="rounded-lg border border-border bg-panel shadow-soft overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          onClick={prevMonth}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-background transition"
          aria-label="Previous month"
          type="button"
        >
          <ChevronLeft size={16} />
        </button>
        <h2 className="font-semibold text-base">
          {MONTHS[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-background transition"
          aria-label="Next month"
          type="button"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DOW_HEADERS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="min-h-[80px] border-b border-r border-border bg-background/30" />;
          }

          const dayApts = getAppointmentsForDay(day);
          const todayCell = isToday(year, month, day);
          const pastCell = isPast(year, month, day);
          const dateStr = isoDate(year, month, day);
          const visibleApts = dayApts.slice(0, 3);
          const overflowCount = dayApts.length - visibleApts.length;

          return (
            <div
              key={`day-${day}`}
              onClick={() => onDayClick?.(dateStr)}
              className={[
                "min-h-[80px] border-b border-r border-border p-1.5 transition",
                onDayClick ? "cursor-pointer hover:bg-primary/5" : "",
                pastCell && !todayCell ? "opacity-60" : "",
              ].join(" ")}
            >
              {/* Day number */}
              <div className="mb-1 flex">
                {todayCell ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {day}
                  </span>
                ) : (
                  <span className={`text-xs font-semibold ${pastCell ? "text-muted" : "text-foreground"}`}>
                    {day}
                  </span>
                )}
              </div>

              {/* Appointment pills */}
              <div className="space-y-0.5">
                {visibleApts.map((apt) => (
                  <div
                    key={apt.id}
                    className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${pillClass(apt.status)}`}
                    title={apt.title}
                  >
                    {apt.title}
                  </div>
                ))}
                {overflowCount > 0 && (
                  <div className="px-1 text-[10px] font-medium text-muted">
                    +{overflowCount} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
