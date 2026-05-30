import { Bell, BellOff, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DbWarning } from "@/components/ui/db-warning";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  markNotificationRead,
  markAllRead,
} from "@/app/(dashboard)/notifications/actions";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Relative-time helper (server-side, no dependency)
// ─────────────────────────────────────────────────────────────────────────────

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification item
// ─────────────────────────────────────────────────────────────────────────────

function NotificationItem({
  n,
}: {
  n: {
    id: string;
    title: string;
    body: string;
    read: boolean;
    link: string | null;
    createdAt: Date;
  };
}) {
  return (
    <div
      className={[
        "flex gap-3 py-4",
        !n.read ? "border-l-2 border-primary pl-3" : "pl-[calc(0.75rem+2px)]",
      ].join(" ")}
    >
      {/* Unread dot */}
      <div className="mt-1 shrink-0">
        {!n.read ? (
          <span className="block size-2 rounded-full bg-primary" />
        ) : (
          <span className="block size-2 rounded-full bg-border" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p
          className={[
            "text-sm leading-snug",
            !n.read ? "font-semibold" : "font-normal",
          ].join(" ")}
        >
          {n.title}
        </p>
        <p className="text-sm text-muted">{n.body}</p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <span className="text-xs text-muted">{relTime(n.createdAt)}</span>

          {n.link && (
            <a
              href={n.link}
              className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
            >
              Open
              <ExternalLink size={10} />
            </a>
          )}

          {!n.read && (
            <form action={markNotificationRead}>
              <input type="hidden" name="notificationId" value={n.id} />
              <SubmitButton
                className="rounded px-2 py-0.5 text-xs text-muted hover:bg-background transition"
                pendingText="Marking…"
              >
                Mark read
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function NotificationsPage() {
  const user = await requireUser();
  let databaseUnavailable = false;

  type NotifRow = {
    id: string;
    title: string;
    body: string;
    read: boolean;
    link: string | null;
    createdAt: Date;
  };

  let notifications: NotifRow[] = [];

  try {
    notifications = await prisma.notification.findMany({
      where: { userId: user.id, agencyId: user.agencyId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch (err) {
    console.error("Notifications page fetch failed", err);
    databaseUnavailable = true;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell className="text-primary" size={22} />
          <div>
            <h1 className="text-2xl font-semibold">Notifications</h1>
            <p className="mt-0.5 text-sm text-muted">
              Activity and alerts for your account.
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="info">{unreadCount} unread</Badge>
          )}
        </div>

        {unreadCount > 0 && (
          <form action={markAllRead}>
            <SubmitButton
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-background transition"
              pendingText="Marking…"
            >
              Mark all read
            </SubmitButton>
          </form>
        )}
      </div>

      {databaseUnavailable && <DbWarning />}

      {notifications.length === 0 && !databaseUnavailable && (
        <Card>
          <CardBody>
            <div className="flex flex-col items-center gap-3 py-10 text-muted">
              <BellOff size={32} className="opacity-40" />
              <p className="text-sm">No notifications yet.</p>
            </div>
          </CardBody>
        </Card>
      )}

      {notifications.length > 0 && (
        <div className="space-y-6">
          {/* Unread section */}
          {unread.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Unread</span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {unread.length}
                  </span>
                </div>
              </CardHeader>
              <CardBody>
                <div className="divide-y divide-border">
                  {unread.map((n) => (
                    <NotificationItem key={n.id} n={n} />
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Read / Earlier section */}
          {read.length > 0 && (
            <Card>
              <CardHeader>
                <span className="text-sm font-semibold">
                  {unread.length > 0 ? "Earlier" : "All notifications"}
                </span>
              </CardHeader>
              <CardBody>
                <div className="divide-y divide-border">
                  {read.map((n) => (
                    <NotificationItem key={n.id} n={n} />
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
