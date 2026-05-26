import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ calendarId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { calendarId } = await ctx.params;
  const isUuid = /^[0-9a-f-]{36}$/.test(calendarId);
  const calendar = await prisma.calendar.findFirst({
    where: isUuid ? { id: calendarId } : { bookingPageSlug: calendarId },
    select: {
      id: true,
      name: true,
      description: true,
      timezone: true,
      slotDuration: true,
      location: true,
      conferenceUrl: true,
      logoUrl: true,
      primaryColor: true,
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, label: true, type: true, required: true, options: true },
      },
    },
  });
  if (!calendar) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(calendar);
}
