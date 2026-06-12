import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditTreasury } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { ActualsForm } from "@/components/hoa/ActualsForm";
import { latestActualsMap, buildCategoryBudgets } from "@/lib/treasury/actuals";

export const metadata = { title: "Enter Actuals — Treasury" };

/**
 * Treasury actuals entry page.
 * Redirects to /treasury if no fiscal year exists or if the user cannot edit treasury data.
 * Fetches the current fiscal year's budget line items and latest actuals, then renders ActualsForm.
 */
export default async function ActualsPage() {
  noStore();
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

  if (
    !canEditTreasury(positionResult.data.role, positionResult.data.name)
  ) {
    redirect("/treasury");
  }

  // Get current (most recent) fiscal year
  const fyResult = await supabase
    .from("fiscal_years")
    .select("id, label")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fyResult.data) redirect("/treasury");
  const fy = fyResult.data;

  const [itemsResult, actualsResult, cbResult] = await Promise.all([
    supabase.from("budget_line_items").select("*").eq("fiscal_year_id", fy.id),
    supabase
      .from("budget_category_actuals")
      .select("*")
      .eq("fiscal_year_id", fy.id)
      .order("as_of_date", { ascending: false }),
    supabase
      .from("cash_balances")
      .select("*")
      .eq("fiscal_year_id", fy.id)
      .order("as_of_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const actualsMap = latestActualsMap(actualsResult.data ?? []);
  const categories = buildCategoryBudgets(itemsResult.data ?? [], actualsMap);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Enter Actuals — ${fy.label}`}
        subtitle="YTD figures from your Homeside monthly report"
      />
      <SectionCard title="Monthly Entry">
        <ActualsForm
          fiscalYearId={fy.id}
          categories={categories}
          latestCashBalance={cbResult.data ?? null}
        />
      </SectionCard>
    </div>
  );
}
