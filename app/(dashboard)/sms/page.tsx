import { MessageSquareText } from "lucide-react";
import { ModulePage } from "@/components/modules/module-page";

export default function SmsPage() {
  return (
    <ModulePage
      description="SMS uses the conversation model and phone number inventory. A2P 10DLC, toll-free verification, STOP/START, and delivery tracking are next."
      icon={MessageSquareText}
      items={["SMS conversations", "Phone inventory", "A2P tracking next", "Opt-out handling next", "Delivery webhooks next"]}
      title="SMS"
    />
  );
}
