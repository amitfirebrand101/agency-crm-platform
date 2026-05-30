"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  CalendarDays,
  ContactRound,
  GalleryVerticalEnd,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  PhoneCall,
  Settings,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { Route } from "next";

type NavItem = {
  href: Route;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/contacts", label: "Contacts", icon: ContactRound },
      { href: "/conversations", label: "Conversations", icon: MessageSquareText },
      { href: "/calendars", label: "Calendars", icon: CalendarDays },
      { href: "/opportunities", label: "Opportunities", icon: Target },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/marketing", label: "Campaigns", icon: Megaphone },
      { href: "/sms", label: "SMS", icon: MessageSquareText },
      { href: "/calling", label: "Calling", icon: PhoneCall },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/automations", label: "Workflows", icon: Bot },
    ],
  },
  {
    label: "Sites",
    items: [
      { href: "/sites", label: "Sites", icon: GalleryVerticalEnd },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/sub-accounts", label: "Sub Accounts", icon: Building2 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2">
      {navGroups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? "mt-5" : ""}>
          {group.label ? (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-heading">
              {group.label}
            </p>
          ) : null}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) ||
                (item.href !== "/dashboard" && pathname === item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-sidebar-active text-sidebar-text-active"
                      : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
                  )}
                >
                  <item.icon
                    size={16}
                    className={cn(
                      "shrink-0 transition-colors",
                      active
                        ? "text-sidebar-text-active"
                        : "text-sidebar-text group-hover:text-sidebar-text-active"
                    )}
                  />
                  {item.label}
                  {active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
