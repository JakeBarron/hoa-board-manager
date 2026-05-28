import { PageHeader } from "@/components/hoa/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SectionCard } from "@/components/hoa/SectionCard";
import type { Position } from "@/types/database";

export const metadata = { title: "Manage Positions — HOA Board" };

/**
 * Admin page — president only.
 * Lists all positions and their current assigned emails.
 * Full reassignment form comes in a future iteration.
 */
export default async function ManagePositionsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify president role before rendering
  const { data: positionData } = await supabase
    .from("positions")
    .select("role")
    .eq("email", user.email!)
    .single();

  if ((positionData as { role: string } | null)?.role !== "president") redirect("/dashboard");

  const { data: positions } = await supabase
    .from("positions")
    .select("*")
    .order("name");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Positions"
        subtitle="Reassign board positions when members change"
      />
      <SectionCard title="Current Board" description="Update emails to transfer positions to new members">
        <div className="divide-y">
          {(positions ?? []).map((pos: Position) => (
            <div key={pos.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium capitalize">
                  {pos.name === "vp" ? "Vice President" : pos.name}
                </p>
                <p className="text-xs text-muted-foreground">{pos.email}</p>
              </div>
              <span className="text-xs text-muted-foreground">Edit coming soon</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
