import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-muted mb-4">
        <Link
          href={"/settings" as never}
          className="hover:text-foreground transition-colors"
        >
          Settings
        </Link>
        <ChevronRight size={12} className="shrink-0" />
        <Link
          href={"/settings/integrations" as never}
          className="hover:text-foreground transition-colors"
        >
          Integrations
        </Link>
      </nav>

      {children}
    </div>
  );
}
