import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditCRA } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { CRAProjectList } from "@/components/hoa/CRAProjectList";
import { Button } from "@/components/ui/button";
import type { CRAProject, CRAQuote, CRAUpdate, CRADocument } from "@/types/database";

export const metadata = { title: "CRA Projects — HOA Board" };

/**
 * Capital Reserve Analysis project list — Open/Complete tabs with totals.
 * Fetches full nested data for all projects so cards can expand inline.
 * Reads `expand` from searchParams to open a project card on load (e.g. after
 * creating a new project via /cra/new).
 */
export default async function CRAPage({
  searchParams,
}: {
  searchParams: Promise<{ expand?: string }>;
}) {
  const { expand } = await searchParams;
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

  const [projectsRes, quotesRes, updatesRes, docsRes, fyRes] = await Promise.all([
    supabase.from("cra_projects").select("*"),
    supabase.from("cra_quotes").select("*").order("created_at"),
    supabase.from("cra_updates").select("*, positions:created_by(name)").order("created_at", { ascending: false }),
    supabase.from("cra_documents").select("*").order("created_at"),
    supabase.from("fiscal_years").select("id, label").order("start_date", { ascending: false }),
  ]);

  const projects = (projectsRes.data ?? []) as CRAProject[];
  const allQuotes = (quotesRes.data ?? []) as CRAQuote[];
  const allUpdates = (updatesRes.data ?? []) as (CRAUpdate & { positions: { name: string } | null })[];
  const allDocuments = (docsRes.data ?? []) as CRADocument[];
  const fiscalYears = fyRes.data ?? [];

  const quotesByProject: Record<string, CRAQuote[]> = {};
  for (const q of allQuotes) {
    if (!quotesByProject[q.project_id]) quotesByProject[q.project_id] = [];
    quotesByProject[q.project_id].push(q);
  }

  const updatesByProject: Record<string, (CRAUpdate & { positions: { name: string } | null })[]> = {};
  for (const u of allUpdates) {
    if (!updatesByProject[u.project_id]) updatesByProject[u.project_id] = [];
    updatesByProject[u.project_id].push(u);
  }

  const documentsByProject: Record<string, CRADocument[]> = {};
  for (const d of allDocuments) {
    if (!documentsByProject[d.project_id]) documentsByProject[d.project_id] = [];
    documentsByProject[d.project_id].push(d);
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
      <CRAProjectList
        projects={projects}
        quotesByProject={quotesByProject}
        updatesByProject={updatesByProject}
        documentsByProject={documentsByProject}
        fiscalYears={fiscalYears}
        canEdit={canEdit}
        positionId={position.id}
        initialExpandedId={expand ?? null}
      />
    </div>
  );
}
