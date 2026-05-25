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
    },
  });
  if (!calendar) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(calendar);
}
