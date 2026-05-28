import { PageHeader } from "@/components/hoa/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "New Architecture Request — HOA Board" };

export default function NewArchitectureRequestPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Architecture Request"
        subtitle="Upload a scanned form and describe the project"
        action={
          <Button variant="outline" render={<Link href="/architecture" />}>Cancel</Button>
        }
      />
      <p className="text-sm text-muted-foreground">Coming soon — form goes here.</p>
    </div>
  );
}
