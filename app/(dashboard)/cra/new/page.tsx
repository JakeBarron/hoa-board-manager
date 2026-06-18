import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditCRA } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { CRAProjectForm } from "@/components/hoa/CRAProjectForm";
import { Button } from "@/components/ui/button";

export const metadata = { title: "New CRA Project — HOA Board" };

/**
 * Create a new CRA project — officers and the CRA chair only.
 * Fetches fiscal years, existing categories, and HOA name in parallel.
 */
export default async function NewCRAProjectPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions").select("id, name, role").eq("email", user.email!).single();
  if (!position) redirect("/login");
  if (!canEditCRA(position.role, position.name)) redirect("/cra");

  const [fyRes, catRes, hoaRes] = await Promise.all([
    supabase.from("fiscal_years").select("id, label").order("start_date", { ascending: false }),
    supabase.from("cra_projects").select("category"),
    supabase.from("settings").select("value").eq("key", "hoa_name").single(),
  ]);

  const fiscalYears = fyRes.data ?? [];
  const existingCategories = Array.from(
    new Set((catRes.data ?? []).map((r) => r.category).filter((c): c is string => !!c))
  ).sort();
  const hoaName = hoaRes.data?.value ?? "your HOA";
  const defaultFiscalYearId = fiscalYears[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New CRA Project"
        subtitle="Add a new capital improvement project"
        action={<Button variant="outline" nativeButton={false} render={<Link href="/cra" />}>Cancel</Button>}
      />
      <CRAProjectForm
        fiscalYears={fiscalYears}
        defaultFiscalYearId={defaultFiscalYearId}
        existingCategories={existingCategories}
        hoaName={hoaName}
      />
    </div>
  );
}
