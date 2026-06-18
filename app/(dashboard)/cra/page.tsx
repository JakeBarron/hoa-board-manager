import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditCRA } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { CRAProjectList } from "@/components/hoa/CRAProjectList";
import { Button } from "@/components/ui/button";
import type { CRAProject } from "@/types/database";

export const metadata = { title: "CRA Projects — HOA Board" };

/** Capital Reserve Analysis project list — Open/Complete tabs with totals. */
export default async function CRAPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions").select("id, name, role").eq("email", user.email!).single();
  if (!position) redirect("/login");
  // Chairs are restricted — except the CRA chair, who owns this page.
  if (isChair(position.role) && position.name !== "cra") {
    redirect(`/committee/${position.name}`);
  }

  const [projectsRes, quotesRes, fyRes] = await Promise.all([
    supabase.from("cra_projects").select("*"),
    supabase.from("cra_quotes").select("project_id"),
    supabase.from("fiscal_years").select("id, label").order("start_date", { ascending: false }),
  ]);

  const projects = (projectsRes.data ?? []) as CRAProject[];
  const quoteRows = quotesRes.data ?? [];
  const fiscalYears = fyRes.data ?? [];

  const quoteCounts: Record<string, number> = {};
  for (const q of quoteRows) {
    quoteCounts[q.project_id] = (quoteCounts[q.project_id] ?? 0) + 1;
  }

  const canEdit = canEditCRA(position.role, position.name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Capital Reserves Analysis"
        subtitle="Track ongoing capital improvement projects"
        action={
          canEdit ? (
            <Button nativeButton={false} render={<Link href="/cra/new" />}>New Project</Button>
          ) : undefined
        }
      />
      <CRAProjectList projects={projects} quoteCounts={quoteCounts} fiscalYears={fiscalYears} />
    </div>
  );
}
