import Link from "next/link";
import { CalendarDays, Clock, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { createCalendar } from "@/app/(dashboard)/module-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CalendarWithDetails = Prisma.CalendarGetPayload<{
  include: {
    _count: { select: { appointments: true } };
    appointments: { where: { startsAt: { gte: Date } }; orderBy: { startsAt: "asc" }; take: 1 };
  };
}>;

export default async function CalendarsPage() {
  const user = await requireUser();
  let databaseUnavailable = false;
  let calendars: CalendarWithDetails[] = [];

  try {
    const now = new Date();
    calendars = await prisma.calendar.findMany({
      where: { agencyId: user.agencyId, subAccountId: user.subAccountId ?? undefined },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { appointments: true } },
        appointments: {
          where: { startsAt: { gte: now } },
          orderBy: { startsAt: "asc" },
          take: 1,
        },
      },
    });
  } catch (error) {
    databaseUnavailable = true;
    console.error("Calendars page database query failed", error);
  }

  const totalAppointments = calendars.reduce((sum, c) => sum + c._count.appointments, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Calendars</h1>
          <p className="mt-1 text-sm text-muted">Booking calendars and appointment management per sub account.</p>
        </div>
      </div>

      {databaseUnavailable ? <DbWarning /> : null}

      {/* Stats row */}
      {!databaseUnavailable && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CalendarDays className="text-primary" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{calendars.length}</p>
                  <p className="text-xs text-muted">Total calendars</p>
                </div>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <Clock className="text-emerald-700" size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalAppointments}</p>
                  <p className="text-xs text-muted">Total appointments</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        {/* Calendar grid */}
        <div className="space-y-4">
          {calendars.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {calendars.map((calendar) => {
                const nextApt = calendar.appointments[0] ?? null;
                return (
                  <Card key={calendar.id} className="flex flex-col transition hover:border-primary">
                    <CardBody className="flex flex-1 flex-col">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <CalendarDays className="text-primary" size={18} />
                        </div>
                        <Badge variant={calendar._count.appointments > 0 ? "info" : "muted"}>
                          {calendar._count.appointments} appts
                        </Badge>
                      </div>
                      <h2 className="font-semibold leading-snug">{calendar.name}</h2>
                      <p className="mt-0.5 text-xs text-muted">{calendar.timezone || "No timezone set"}</p>

                      {nextApt ? (
                        <p className="mt-3 text-xs text-muted">
                          Next:{" "}
                          <span className="font-medium text-foreground">
                            {new Date(nextApt.startsAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </p>
                      ) : (
                        <p className="mt-3 text-xs text-muted">No upcoming appointments</p>
                      )}

                      <div className="mt-4 flex-1" />
                      <Link
                        href={`/calendars/${calendar.id}`}
                        className="mt-3 block w-full rounded-md border border-border px-3 py-1.5 text-center text-xs font-semibold transition hover:bg-primary hover:text-white hover:border-primary"
                      >
                        View calendar
                      </Link>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          ) : (
            !databaseUnavailable && (
              <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
                <CalendarDays className="mx-auto mb-3 text-muted/50" size={32} />
                <p className="font-medium">No calendars yet</p>
                <p className="mt-1 text-xs">Create your first calendar using the form on the right.</p>
              </div>
            )
          )}
        </div>

        {/* New calendar form */}
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
              <button
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                type="submit"
              >
                Create calendar
              </button>
            </form>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
