import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditTreasury, isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { CSVImportDialog } from "@/components/hoa/CSVImportDialog";
import { approveBudget, createFiscalYear, initializeAssessments } from "@/actions/treasury";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Budget — Treasury" };

export default async function BudgetPage() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const positionResult = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();
  if (!positionResult.data) redirect("/login");
  const position = positionResult.data;

  if (!canEditTreasury(position.role, position.name)) redirect("/treasury");

  const fyResult = await supabase
    .from("fiscal_years")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fy = fyResult.data;

  const lineItemsResult = fy
    ? await supabase
        .from("budget_line_items")
        .select("id, gl_code, description, category, account_type, budget_amount")
        .eq("fiscal_year_id", fy.id)
        .order("category")
    : null;

  const lineItems = lineItemsResult?.data ?? [];
  const canApprove = isAdmin(position.role) && fy?.status === "draft";
  const isDraft = fy?.status === "draft";

  async function handleApprove() {
    "use server";
    if (fy) await approveBudget(fy.id);
  }

  async function handleInitAssessments() {
    "use server";
    if (fy) await initializeAssessments(fy.id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget Management"
        subtitle={fy ? `${fy.label} · ${fy.start_date} to ${fy.end_date}` : "No fiscal year set up"}
      />

      {fy && (
        <SectionCard title={fy.label}>
          <p className="text-sm text-muted-foreground mb-4">
            Status: <span className="font-medium capitalize">{fy.status}</span> · Default assessment: ${(fy.default_assessment_amount / 100).toLocaleString()}
          </p>

          <div className="flex flex-wrap gap-3">
            {canApprove && (
              <form action={handleApprove}>
                <Button type="submit" variant="outline">
                  Approve Budget (lock from re-import)
                </Button>
              </form>
            )}
            <form action={handleInitAssessments}>
              <Button type="submit" variant="outline">
                Initialize Assessments
              </Button>
            </form>
          </div>
        </SectionCard>
      )}

      {isDraft && fy && (
        <SectionCard title="Import CSV Budget">
          <CSVImportDialog
            fiscalYearId={fy.id}
            fiscalYearStart={fy.start_date}
            onSuccess={() => {}}
          />
        </SectionCard>
      )}

      {lineItems.length > 0 && (
        <SectionCard title={`GL Line Items (${lineItems.length})`}>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left p-2 font-medium">GL Code</th>
                  <th className="text-left p-2 font-medium">Description</th>
                  <th className="text-left p-2 font-medium">Category</th>
                  <th className="text-left p-2 font-medium">Type</th>
                  <th className="text-right p-2 font-medium">Budget</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item) => (
                  <tr key={item.id} className="border-b hover:bg-muted/30 text-sm">
                    <td className="p-2 font-mono text-xs">{item.gl_code}</td>
                    <td className="p-2">{item.description}</td>
                    <td className="p-2">{item.category}</td>
                    <td className="p-2 text-xs text-muted-foreground">{item.account_type}</td>
                    <td className="p-2 text-right">${(item.budget_amount / 100).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {!fy && (
        <SectionCard title="Create Fiscal Year">
          <p className="text-sm text-muted-foreground mb-4">
            No fiscal year exists yet. ESL fiscal year runs April 1 – March 31.
          </p>
          <form
            action={async (formData: FormData) => {
              "use server";
              const label = formData.get("label") as string;
              const startDate = formData.get("start_date") as string;
              const endDate = formData.get("end_date") as string;
              const amountDollars = parseFloat(formData.get("assessment") as string);
              await createFiscalYear(label, startDate, endDate, Math.round(amountDollars * 100));
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="label">Label (e.g. FY26)</label>
                <input id="label" name="label" required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="assessment">Annual Assessment ($)</label>
                <input id="assessment" name="assessment" type="number" step="0.01" required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="start_date">Start Date</label>
                <input id="start_date" name="start_date" type="date" required defaultValue="2025-04-01" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="end_date">End Date</label>
                <input id="end_date" name="end_date" type="date" required defaultValue="2026-03-31" className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <Button type="submit">Create Fiscal Year</Button>
          </form>
        </SectionCard>
      )}
    </div>
  );
}
