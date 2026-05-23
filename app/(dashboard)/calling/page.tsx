import { PhoneCall } from "lucide-react";
import { ModulePage } from "@/components/modules/module-page";

export default function CallingPage() {
  return (
    <ModulePage
      description="Phone number inventory is modeled for future Twilio or Telnyx calling, recording, voicemail, and forwarding."
      icon={PhoneCall}
      items={["Phone number records", "Provider status", "Call events next", "Voicemail next", "Recording consent settings next"]}
      title="Calling"
    />
  );
}
