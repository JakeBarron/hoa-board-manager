import { PageHeader } from "@/components/hoa/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "New CRA Project — HOA Board" };

export default function NewCRAProjectPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New CRA Project"
        subtitle="Add a new capital improvement project"
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/cra" />}>Cancel</Button>
        }
      />
      <p className="text-sm text-muted-foreground">Coming soon — form goes here.</p>
    </div>
  );
}
