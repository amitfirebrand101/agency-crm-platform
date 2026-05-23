import { GalleryVerticalEnd } from "lucide-react";
import { ModulePage } from "@/components/modules/module-page";

export default function SitesPage() {
  return (
    <ModulePage
      description="Site records and custom domain slots are modeled. Page builder, forms, surveys, and publishing come later."
      icon={GalleryVerticalEnd}
      items={["Sites", "Domains", "Draft status", "Publishing pipeline next", "Forms and surveys next"]}
      title="Sites"
    />
  );
}
