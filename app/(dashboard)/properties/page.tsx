import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { PropertiesView } from "@/components/hoa/PropertiesView";

export const metadata = {
  title: "Properties — HOA Board",
};

/**
 * Properties table page.
 * Fetches all properties server-side and passes them to PropertiesView for
 * client-side filtering. Restricted to voting members; chairs are redirected.
 */
export default async function PropertiesPage() {
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
      "id, lot_number, first_name, last_name, account_number, street_address, membership, membership_type, annual_lease_fee, has_annual_lease_fee, email_1, email_2, key_fob_1, key_fob_2, sayor"
    )
    .order("lot_number");

  const lots = propertiesResult.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle="Neighborhood lots and membership information"
      />
      <PropertiesView lots={lots} />
    </div>
  );
}
