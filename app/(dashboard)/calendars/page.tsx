import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createCalendar } from "@/app/(dashboard)/module-actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CalendarWithCounts = Prisma.CalendarGetPayload<{
  include: { _count: { select: { appointments: true } } };
}>;

export default async function CalendarsPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let calendars: CalendarWithCounts[] = [];

  try {
    calendars = await prisma.calendar.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { appointments: true } } }
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Calendars page database query failed", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Calendars</h1>
        <p className="mt-1 text-sm text-muted">Booking calendars and appointment management per sub account.</p>
      </div>
      {databaseUnavailable ? <DbWarning /> : null}
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid gap-4 md:grid-cols-2">
          {calendars.map((calendar) => (
            <Link href={`/calendars/${calendar.id}`} key={calendar.id}>
              <Card className="transition hover:border-primary">
                <CardBody>
                  <CalendarDays className="mb-4 text-primary" size={20} />
                  <h2 className="font-semibold">{calendar.name}</h2>
                  <p className="mt-1 text-sm text-muted">{calendar.timezone}</p>
                  <p className="mt-4 text-sm font-medium">{calendar._count.appointments} appointments</p>
                </CardBody>
              </Card>
            </Link>
          ))}
          {!calendars.length ? (
            <div className="col-span-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
              No calendars yet. Create your first one.
            </div>
          ) : null}
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Plus className="text-primary" size={18} />
              <h2 className="font-semibold">New calendar</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form action={createCalendar} className="space-y-3">
              <Field label="Name" name="name" placeholder="Sales calls" required />
              <button className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white" type="submit">
                Create calendar
              </button>
            </form>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
