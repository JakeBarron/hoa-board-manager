import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { MapView } from "@/components/hoa/MapView";

export const metadata = {
  title: "Properties — HOA Board",
};

/**
 * Neighborhood lot map page.
 * Fetches all properties server-side and passes them to MapView for client-side interaction.
 * Restricted to voting members (president, officer, member). Chairs are redirected.
 * noStore() prevents Next.js from caching this response across sessions.
 */
export default async function MapPage() {
  noStore();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positionResult = await supabase
    .from("positions")
    .select("role")
    .eq("email", user.email!)
    .single();

  if (!positionResult.data) redirect("/login");
  if (isChair(positionResult.data.role)) redirect("/dashboard");

  const propertiesResult = await supabase
    .from("properties")
    .select(
      "id, lot_number, first_name, last_name, account_number, street_address, membership, membership_type, annual_lease_fee, email_1, email_2, key_fob_1, key_fob_2, sayor"
    )
    .order("lot_number");

  const lots = propertiesResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle="Neighborhood lots and property information"
      />
      <MapView lots={lots} />
    </div>
  );
}
