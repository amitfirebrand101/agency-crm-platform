import { CalendarDays } from "lucide-react";
import { ModulePage } from "@/components/modules/module-page";

export default function CalendarsPage() {
  return (
    <ModulePage
      description="Calendar and appointment models for bookings, contact linkage, availability, reminders, and future provider sync."
      icon={CalendarDays}
      items={["Calendars", "Appointments", "Contact booking history", "Timezone-safe records", "Reminder jobs next"]}
      title="Calendars"
    />
  );
}
