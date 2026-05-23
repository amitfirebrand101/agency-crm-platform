import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-background text-foreground border-border",
  success: "bg-green-50 text-green-800 border-green-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-800 border-red-200",
  info: "bg-blue-50 text-blue-800 border-blue-200",
  muted: "bg-background text-muted border-border"
};

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold", variantClasses[variant], className)}>
      {children}
    </span>
  );
}

export function statusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (["published", "active", "completed", "won", "confirmed", "scheduled", "customer"].includes(s)) return "success";
  if (["draft", "pending", "waiting", "reserved", "lead"].includes(s)) return "warning";
  if (["failed", "lost", "cancelled", "abandoned", "inactive", "no_show"].includes(s)) return "danger";
  if (["open", "running"].includes(s)) return "info";
  return "muted";
}
