import { Bot } from "lucide-react";
import { ModulePage } from "@/components/modules/module-page";

export default function AutomationsPage() {
  return (
    <ModulePage
      description="Automation definitions are tenant-scoped now. Execution engine, queue workers, retries, and event triggers come in the provider phase."
      icon={Bot}
      items={["Workflow definitions", "Draft/published states", "JSON graph storage", "Event trigger model next", "Queue execution next"]}
      title="Automations"
    />
  );
}
