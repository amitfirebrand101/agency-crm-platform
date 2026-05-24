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
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: ContactRound },
  { href: "/conversations", label: "Conversations", icon: MessageSquareText },
  { href: "/calendars", label: "Calendars", icon: CalendarDays },
  { href: "/automations", label: "Automations", icon: Bot },
  { href: "/opportunities", label: "Opportunities", icon: Target },
  { href: "/sites", label: "Sites", icon: GalleryVerticalEnd },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/calling", label: "Calling", icon: PhoneCall },
  { href: "/sms", label: "SMS", icon: MessageSquareText },
  { href: "/sub-accounts", label: "Sub accounts", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings }
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted hover:bg-background hover:text-foreground"
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
