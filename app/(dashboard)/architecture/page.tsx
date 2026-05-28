import { PageHeader } from "@/components/hoa/PageHeader";
import { EmptyState } from "@/components/hoa/EmptyState";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "Architecture Approvals — HOA Board" };

export default function ArchitecturePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Architecture Approvals"
        subtitle="Review and vote on homeowner architecture requests"
        action={
          <Button render={<Link href="/architecture/new" />}>New Request</Button>
        }
      />
      <EmptyState
        title="No architecture requests yet"
        description="Create a new request to get started."
        action={
          <Button variant="outline" render={<Link href="/architecture/new" />}>New Request</Button>
        }
      />
    </div>
  );
}
