import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "New CRA Project — HOA Board" };

/**
 * Stub page for creating a new Capital Reserve Account project.
 * Redirects chairs to their committee page; form content is coming soon.
 */
export default async function NewCRAProjectPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentPosition } = await supabase
    .from("positions")
    .select("id, name, role")
    .eq("email", user.email!)
    .single();

  if (!currentPosition) redirect("/login");
  if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);

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
