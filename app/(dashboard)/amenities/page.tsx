import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { EmptyState } from "@/components/hoa/EmptyState";

export const metadata = {
  title: "Amenities — HOA Board",
};

/**
 * Amenities page. Will show Pool, Clubhouse, and Tennis widgets.
 * Placeholder pending amenity-specific feature specs.
 * Restricted to voting members (president, officer, member); chairs are redirected.
 */
export default async function AmenitiesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentPosition } = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();

  if (!currentPosition) redirect("/login");
  if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Amenities"
        subtitle="Pool, Clubhouse, and Tennis"
      />
      <EmptyState
        title="Coming soon"
        description="Amenity management tools are being built."
      />
    </div>
  );
}
