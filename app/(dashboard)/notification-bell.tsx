"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  link: string | null;
  createdAt: string;
};

function relTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loadedFull, setLoadedFull] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Lightweight count poll — only fetches a number, not full payloads
  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { count: number };
        setUnreadCount(data.count ?? 0);
      }
    } catch {
      // Silently ignore — bell shows stale count
    }
  }, []);

  // Full notifications — only fetched when dropdown is opened
  const fetchFull = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { notifications: Notification[] };
        const list = data.notifications ?? [];
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.read).length);
        setLoadedFull(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Poll count every 60s, pausing when the tab is hidden
  useEffect(() => {
    fetchCount();

    function tick() {
      if (!document.hidden) fetchCount();
    }
    const interval = setInterval(tick, 60_000);
    const onVisible = () => { if (!document.hidden) fetchCount(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchCount]);

  // Load full list when dropdown first opens
  useEffect(() => {
    if (open && !loadedFull) fetchFull();
  }, [open, loadedFull, fetchFull]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markRead(id: string) {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
  }

  async function markAllRead() {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    // Single batch request
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link as Parameters<typeof router.push>[0]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-background hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-lg border border-border bg-panel shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={markAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!loadedFull ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition last:border-0 hover:bg-background ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm leading-tight ${!n.read ? "font-semibold" : "font-medium"}`}>
                      {n.title}
                      {!n.read && (
                        <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />
                      )}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">{relTime(n.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted line-clamp-2">{n.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
