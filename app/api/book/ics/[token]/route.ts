/**
 * GET /api/book/ics/[token]
 *
 * Public endpoint — no auth required.
 * Returns an ICS calendar file for a confirmed appointment.
 * Uses confirmToken as the lookup key.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ token: string }> };

/** Format a Date as ICS UTC timestamp: YYYYMMDDTHHmmssZ */
function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Fold long ICS lines at 75 octets as per RFC 5545 §3.1 */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let start = 0;
  let isFirst = true;

  while (start < bytes.length) {
    const maxLen = isFirst ? 75 : 74; // continuation lines get 1-char indent
    let end = start + maxLen;
    if (end >= bytes.length) {
      chunks.push(new TextDecoder().decode(bytes.slice(start)));
      break;
    }
    // Don't split in the middle of a multi-byte UTF-8 sequence
    while (end > start && (bytes[end]! & 0xc0) === 0x80) end--;
    chunks.push(new TextDecoder().decode(bytes.slice(start, end)));
    start = end;
    isFirst = false;
  }

  return chunks.join("\r\n ");
}

/** Escape special characters in ICS text values per RFC 5545 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;

  const appointment = await prisma.appointment.findUnique({
    where: { confirmToken: token },
    include: { calendar: true },
  });

  if (!appointment) {
    return new NextResponse("Appointment not found.", { status: 404 });
  }

  const now = new Date();
  const location = appointment.calendar.conferenceUrl ?? appointment.calendar.location ?? "";
  const description = appointment.notes ?? appointment.calendar.name;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agency CRM//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    foldLine(`UID:${appointment.id}@agency-crm`),
    foldLine(`DTSTAMP:${toIcsDate(now)}`),
    foldLine(`DTSTART:${toIcsDate(appointment.startsAt)}`),
    foldLine(`DTEND:${toIcsDate(appointment.endsAt)}`),
    foldLine(`SUMMARY:${escapeIcsText(appointment.title)}`),
    foldLine(`DESCRIPTION:${escapeIcsText(description)}`),
    foldLine(`LOCATION:${escapeIcsText(location)}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const icsContent = lines.join("\r\n") + "\r\n";

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="appointment.ics"',
      "Cache-Control": "no-store",
    },
  });
}
