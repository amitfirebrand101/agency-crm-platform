import { MessageSquareText } from "lucide-react";
import { ModulePage } from "@/components/modules/module-page";

export default function ConversationsPage() {
  return (
    <ModulePage
      description="Unified inbox foundation for SMS, email, calls, voicemail, internal notes, assignment, and status tracking."
      icon={MessageSquareText}
      items={["Conversation threads", "Message records", "Contact linking", "Open/pending/closed status", "Provider webhooks next"]}
      title="Conversations"
    />
  );
}
