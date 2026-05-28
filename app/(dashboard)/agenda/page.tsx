import { PageHeader } from "@/components/hoa/PageHeader";
import { EmptyState } from "@/components/hoa/EmptyState";

export const metadata = { title: "Meeting Agenda — HOA Board" };

export default function AgendaPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Meeting Agenda"
        subtitle="Generated from board members' pre-meeting status updates"
      />
      <EmptyState
        title="No updates submitted yet"
        description="Ask each board member to submit a pre-meeting update to generate the agenda."
      />
    </div>
  );
}
