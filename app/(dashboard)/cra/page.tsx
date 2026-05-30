import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { EmptyState } from "@/components/hoa/EmptyState";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata = { title: "CRA Projects — HOA Board" };

export default async function CRAPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
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
        title="Capital Reserves Analysis"
        subtitle="Track ongoing capital improvement projects"
        action={
          <Button nativeButton={false} render={<Link href="/cra/new" />}>New Project</Button>
        }
      />
      <EmptyState
        title="No CRA projects yet"
        description="Create a new project to start tracking quotes and status updates."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href="/cra/new" />}>New Project</Button>
        }
      />
    </div>
  );
}
