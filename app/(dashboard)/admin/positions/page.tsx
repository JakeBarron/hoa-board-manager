import { PageHeader } from "@/components/hoa/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isChair } from "@/lib/permissions";
import { SectionCard } from "@/components/hoa/SectionCard";
import { PositionEditRow } from "./PositionEditRow";
import type { PositionName } from "@/types/database";

export const metadata = { title: "Manage Positions — HOA Board" };

/**
 * Admin page — president only.
 * Lists all positions with inline edit forms for display name and email.
 * Changing an email auto-updates the Supabase auth user and sends a password reset.
 */
export default async function ManagePositionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: positionData } = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();

  if (!positionData) redirect("/login");
  if (isChair(positionData.role)) redirect(`/committee/${positionData.name}`);
  if (positionData.role !== "president") redirect("/dashboard");

  const { data: positions } = await supabase
    .from("positions")
    .select("id, name, role, email, display_name, phone")
    .neq("role", "chair")
    .order("name");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Positions"
        subtitle="Update who holds each board position"
      />
      <SectionCard
        title="Board Members"
        description="Set a display name so it appears in meeting minutes. Change the email to reassign a position — a password reset will be sent automatically."
      >
        <div className="divide-y divide-border">
          {(positions ?? []).map((pos) => (
            <PositionEditRow
              key={pos.id}
              position={{
                id: pos.id,
                name: pos.name as PositionName,
                role: pos.role,
                email: pos.email,
                display_name: pos.display_name,
                phone: pos.phone,
              }}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
