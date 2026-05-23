import { Megaphone } from "lucide-react";
import { ModulePage } from "@/components/modules/module-page";

export default function MarketingPage() {
  return (
    <ModulePage
      description="Campaign records are prepared for email and SMS marketing once provider credentials and compliance flows are configured."
      icon={Megaphone}
      items={["Campaigns", "Channel status", "Audience segments next", "Email provider next", "SMS compliance next"]}
      title="Marketing"
    />
  );
}
