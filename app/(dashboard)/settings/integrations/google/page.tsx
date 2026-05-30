import { CalendarDays, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserToken } from "@/lib/google-calendar";
import {
  disconnectGoogle,
  syncAppointment,
  syncAllAppointments,
} from "@/app/(dashboard)/settings/integrations/google/actions";

export const dynamic = "force-dynamic";

function googleConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID?.replace(/^["']|["']$/g, "") &&
    process.env.GOOGLE_CLIENT_SECRET?.replace(/^["']|["']$/g, "")
  );
}

export default async function GoogleCalendarIntegrationPage({
  searchParams,
}: {
  searchParams?: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user   = await requireUser();

  // If env vars are missing, surface a setup notice and bail early
  if (!googleConfigured()) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Google Calendar Integration</h1>
          <p className="mt-1 text-sm text-muted">
            Sync appointments directly to Google Calendar.
          </p>
        </div>

        <Card>
          <CardBody>
            <div className="flex items-start gap-4 py-2">
              <XCircle className="mt-0.5 shrink-0 text-amber-500" size={20} />
              <div>
                <p className="font-semibold">Google Calendar is not configured</p>
                <p className="mt-1 text-sm text-muted">
                  Add{" "}
                  <code className="rounded bg-background px-1 font-mono text-xs">
                    GOOGLE_CLIENT_ID
                  </code>{" "}
                  and{" "}
                  <code className="rounded bg-background px-1 font-mono text-xs">
                    GOOGLE_CLIENT_SECRET
                  </code>{" "}
                  to your environment variables to enable this integration.
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Load token + upcoming appointments in parallel
  const now = new Date();

  const [tokenBlob, appointments] = await Promise.all([
    getUserToken(user.id),
    prisma.appointment.findMany({
      where: {
        startsAt: { gte: now },
        calendar: {
          agencyId: user.agencyId,
          ...(user.subAccountId ? { subAccountId: user.subAccountId } : {}),
        },
      },
      include: { calendar: true },
      orderBy: { startsAt: "asc" },
      take:    50,
    }),
  ]);

  const isConnected = !!tokenBlob;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Google Calendar Integration</h1>
        <p className="mt-1 text-sm text-muted">
          Connect your Google Calendar to automatically sync appointments.
        </p>
      </div>

      {/* Flash messages */}
      {params?.connected === "1" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={16} />
          Google Calendar connected successfully.
        </div>
      )}
      {params?.error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <XCircle size={16} />
          {params.error === "not_configured"
            ? "Google Calendar is not configured. Check your GOOGLE_CLIENT_ID env var."
            : "Failed to connect Google Calendar. Please try again."}
        </div>
      )}

      {/* Connection status card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="text-primary" size={16} />
            <h2 className="font-semibold">Connection</h2>
          </div>
        </CardHeader>
        <CardBody>
          {isConnected ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-green-500" size={20} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Connected</span>
                    <Badge variant="success">Active</Badge>
                  </div>
                  {tokenBlob.email && (
                    <p className="mt-0.5 text-sm text-muted">{tokenBlob.email}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted">
                    Calendar:{" "}
                    <span className="font-mono">{tokenBlob.calendarId}</span>
                  </p>
                </div>
              </div>
              <form action={disconnectGoogle}>
                <SubmitButton
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 transition"
                  pendingText="Disconnecting…"
                >
                  Disconnect
                </SubmitButton>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 shrink-0 text-muted" size={20} />
                <div>
                  <span className="font-semibold">Not connected</span>
                  <p className="mt-0.5 text-sm text-muted">
                    Connect your Google account to sync appointments automatically.
                  </p>
                </div>
              </div>
              <a
                href="/api/oauth/google/start"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
              >
                Connect Google Calendar
              </a>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Bulk sync action — only when connected */}
      {isConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="text-primary" size={16} />
              <h2 className="font-semibold">Bulk Sync</h2>
            </div>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-muted">
              Push all upcoming appointments (up to 100) to your Google Calendar at once.
            </p>
            <form action={syncAllAppointments}>
              <SubmitButton
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
                pendingText="Syncing…"
              >
                Sync all upcoming appointments
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Upcoming appointments with sync status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="text-primary" size={16} />
            <h2 className="font-semibold">Upcoming Appointments</h2>
            <span className="rounded bg-background px-2 py-0.5 text-xs font-semibold text-muted">
              {appointments.length}
            </span>
          </div>
        </CardHeader>
        <CardBody>
          {appointments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              No upcoming appointments found.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {appointments.map((appt) => {
                const synced = !!appt.googleEventId;
                return (
                  <div
                    key={appt.id}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{appt.title}</span>
                        <Badge variant={synced ? "success" : "muted"}>
                          {synced ? "Synced" : "Not synced"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {new Date(appt.startsAt).toLocaleString()} — {appt.calendar.name}
                      </p>
                      {appt.contactEmail && (
                        <p className="text-xs text-muted">{appt.contactEmail}</p>
                      )}
                    </div>

                    {isConnected && (
                      <form action={syncAppointment}>
                        <input type="hidden" name="appointmentId" value={appt.id} />
                        <SubmitButton
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-background transition"
                          pendingText={synced ? "Updating…" : "Syncing…"}
                        >
                          {synced ? "Re-sync" : "Sync to Google"}
                        </SubmitButton>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
