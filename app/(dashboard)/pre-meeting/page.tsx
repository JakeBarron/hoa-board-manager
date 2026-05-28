import { PageHeader } from "@/components/hoa/PageHeader";

export const metadata = { title: "Pre-Meeting Update — HOA Board" };

export default function PreMeetingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pre-Meeting Status Update"
        subtitle="Submit your update before the monthly board meeting"
      />
      <p className="text-sm text-muted-foreground">Coming soon — form goes here.</p>
    </div>
  );
}
