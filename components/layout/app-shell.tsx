import Link from "next/link";
import { Activity, Moon } from "lucide-react";
import { signOut } from "@/app/(dashboard)/actions";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { NotificationBell } from "@/app/(dashboard)/notification-bell";
import type { SessionUser } from "@/lib/auth";

const appName = process.env.NEXT_PUBLIC_APP_NAME?.replace(/^["']|["']$/g, "") ?? "GoLowLevel";

type AppShellProps = {
  user: SessionUser;
  children: React.ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-[17rem] border-r border-border bg-panel px-3 py-4 lg:block">
        <Link className="mb-4 flex items-center gap-3 rounded-md px-2 py-2" href="/dashboard">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-white">
            <Activity size={21} />
          </div>
          <div>
            <div className="font-semibold">{appName}</div>
            <div className="text-xs text-muted">Agency CRM</div>
          </div>
        </Link>
        <div className="mb-4 rounded-md border border-border bg-background px-3 py-2">
          <div className="text-xs font-medium uppercase text-muted">Sub account</div>
          <div className="mt-1 truncate text-sm font-semibold">{user.subAccountName ?? "No sub account"}</div>
        </div>
        <SidebarNav />
      </aside>
      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-10 border-b border-border bg-panel/95 px-5 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">{user.agencyName}</p>
              <h1 className="text-lg font-semibold">{user.subAccountName ?? "Agency setup"}</h1>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <button
                aria-label="Theme"
                className="flex size-9 items-center justify-center rounded-md border border-border bg-background text-muted"
                type="button"
              >
                <Moon size={16} />
              </button>
              <div className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2">
                <div className="hidden text-right sm:block">
                  <div className="text-sm font-medium">{user.name ?? user.email}</div>
                  <div className="text-xs text-muted">{user.agencyRole}</div>
                </div>
                <div className="flex size-9 items-center justify-center rounded-md bg-accent text-sm font-bold text-white">
                  {(user.name ?? user.email).slice(0, 1).toUpperCase()}
                </div>
              </div>
              <form action={signOut}>
                <button className="rounded-md border border-border px-3 py-2 text-sm font-medium" type="submit">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
