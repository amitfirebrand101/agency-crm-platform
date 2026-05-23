"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  href: any;
  label: string;
  icon: React.ElementType;
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
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
