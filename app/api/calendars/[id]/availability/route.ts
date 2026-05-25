import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const calendar = await prisma.calendar.findFirst({
      where: { id, agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      include: { availability: { orderBy: { dayOfWeek: "asc" } } },
    });
    if (!calendar) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(calendar);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
