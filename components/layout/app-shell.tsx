import Link from "next/link";
import { ChevronDown, LayoutGrid, Search, Bell } from "lucide-react";
import { signOut } from "@/app/(dashboard)/actions";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { NotificationBell } from "@/app/(dashboard)/notification-bell";
import type { SessionUser } from "@/lib/auth";

const appName =
  process.env.NEXT_PUBLIC_APP_NAME?.replace(/^["']|["']$/g, "") ??
  "GoLowLevel";

type AppShellProps = {
  user: SessionUser;
  children: React.ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const initials = (user.name ?? user.email)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col bg-sidebar-bg border-r border-sidebar-border">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 px-4 py-[18px] border-b border-sidebar-border"
        >
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-white text-xs font-bold shrink-0">
            G
          </div>
          <span className="text-sm font-semibold text-sidebar-text-active truncate">
            {appName}
          </span>
        </Link>

        {/* Location / sub-account switcher */}
        <button
          type="button"
          className="flex items-center gap-2.5 px-4 py-3 border-b border-sidebar-border text-left hover:bg-sidebar-hover transition-colors w-full"
        >
          <div className="flex size-7 items-center justify-center rounded bg-sidebar-active shrink-0">
            <LayoutGrid size={13} className="text-sidebar-text" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-sidebar-text-active leading-tight">
              {user.subAccountName ?? "Agency"}
            </p>
            <p className="text-[10px] text-sidebar-heading leading-tight mt-0.5">
              {user.agencyName}
            </p>
          </div>
          <ChevronDown size={13} className="text-sidebar-heading shrink-0" />
        </button>

        {/* Nav */}
        <SidebarNav />

        {/* User footer */}
        <div className="border-t border-sidebar-border px-3 py-3">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-sidebar-hover transition-colors group"
            >
              <div className="flex size-7 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-sidebar-text-active leading-tight">
                  {user.name ?? user.email}
                </p>
                <p className="text-[10px] text-sidebar-heading leading-tight mt-0.5 capitalize">
                  {user.agencyRole?.toLowerCase()}
                </p>
              </div>
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="shrink-0 flex items-center justify-between gap-4 border-b border-border bg-panel px-6 h-14">
          {/* Left: breadcrumb/title */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{user.agencyName}</span>
            <span className="text-border select-none">/</span>
            <span className="font-medium text-foreground">
              {user.subAccountName ?? "Agency"}
            </span>
          </div>

          {/* Right: search + notifications + user */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative hidden md:flex items-center">
              <Search
                size={14}
                className="absolute left-3 text-muted pointer-events-none"
              />
              <input
                type="search"
                placeholder="Search…"
                className="h-8 w-48 rounded-md border border-border bg-background pl-8 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition"
              />
            </div>

            <NotificationBell />

            {/* Avatar */}
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white cursor-default select-none">
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
