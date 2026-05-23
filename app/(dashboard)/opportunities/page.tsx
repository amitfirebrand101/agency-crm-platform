import { Target } from "lucide-react";
import { ModulePage } from "@/components/modules/module-page";

export default function OpportunitiesPage() {
  return (
    <ModulePage
      description="Pipeline, stage, and opportunity records are ready for deal tracking and kanban implementation."
      icon={Target}
      items={["Pipelines", "Stages", "Opportunities", "Contact linking", "Drag board next"]}
      title="Opportunities"
    />
  );
}
