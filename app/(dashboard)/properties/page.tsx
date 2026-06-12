import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditTreasury } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { PropertiesView } from "@/components/hoa/PropertiesView";
import type { AssessmentStatus } from "@/types/database";

export const metadata = {
  title: "Properties — HOA Board",
};

/**
 * Properties table page.
 * Fetches all properties and the current fiscal year's assessment payments.
 * Restricted to voting members; chairs are redirected.
 */
export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  noStore();
  const { status: initialStatus } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positionResult = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();

  if (!positionResult.data) redirect("/login");
  const position = positionResult.data;
  if (isChair(position.role)) redirect("/dashboard");

  const canEditAssessments = canEditTreasury(position.role, position.name);

  // Fetch properties and current fiscal year in parallel
  const [propertiesResult, fyResult] = await Promise.all([
    supabase
      .from("properties")
      .select(
        "id, lot_number, first_name, last_name, account_number, street_address, membership, membership_type, annual_lease_fee, has_annual_lease_fee, email_1, email_2, key_fob_1, key_fob_2, sayor"
      )
      .order("lot_number"),
    supabase
      .from("fiscal_years")
      .select("id")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lots = propertiesResult.data ?? [];
  const currentFYId = fyResult.data?.id ?? null;

  // Fetch assessment payments for the current fiscal year (if one exists)
  const assessmentsResult = currentFYId
    ? await supabase
        .from("assessment_payments")
        .select("*")
        .eq("fiscal_year_id", currentFYId)
    : null;

  const assessments = assessmentsResult?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle="Neighborhood lots and membership information"
      />
      <PropertiesView
        lots={lots}
        assessments={assessments}
        canEditAssessments={canEditAssessments}
        initialStatusFilter={(initialStatus as AssessmentStatus | undefined) ?? "all"}
      />
    </div>
  );
}
