import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair, canEditCRA } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { CRAProjectHeader } from "@/components/hoa/CRAProjectHeader";
import { CRAQuotesSection } from "@/components/hoa/CRAQuotesSection";
import { CRAUpdatesSection } from "@/components/hoa/CRAUpdatesSection";
import { CRADocumentsSection } from "@/components/hoa/CRADocumentsSection";
import type {
  CRAProject,
  CRAQuote,
  CRAUpdate,
  CRADocument,
} from "@/types/database";

export const metadata = { title: "CRA Project — HOA Board" };

/**
 * CRA project detail — header, quotes, updates log, and documents.
 */
export default async function CRAProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions")
    .select("id, name, role")
    .eq("email", user.email!)
    .single();
  if (!position) redirect("/login");
  if (isChair(position.role) && position.name !== "cra") {
    redirect(`/committee/${position.name}`);
  }

  const [projectRes, quotesRes, updatesRes, docsRes, fyRes] = await Promise.all(
    [
      supabase.from("cra_projects").select("*").eq("id", id).single(),
      supabase
        .from("cra_quotes")
        .select("*")
        .eq("project_id", id)
        .order("created_at"),
      supabase
        .from("cra_updates")
        .select("*, positions:created_by(name)")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("cra_documents")
        .select("*")
        .eq("project_id", id)
        .order("created_at"),
      supabase
        .from("fiscal_years")
        .select("id, label")
        .order("start_date", { ascending: false }),
    ]
  );

  const project = projectRes.data as CRAProject | null;
  if (!project) notFound();

  const quotes = (quotesRes.data ?? []) as CRAQuote[];
  const updates = (updatesRes.data ?? []) as (CRAUpdate & {
    positions: { name: string } | null;
  })[];
  const documents = (docsRes.data ?? []) as CRADocument[];
  const fiscalYears = fyRes.data ?? [];

  const canEdit = canEditCRA(position.role, position.name);

  return (
    <div className="space-y-6">
      <PageHeader title={project.name} subtitle="Capital improvement project" />

      <CRAProjectHeader project={project} fiscalYears={fiscalYears} canEdit={canEdit} />

      <SectionCard title="Quotes">
        <CRAQuotesSection projectId={project.id} quotes={quotes} canEdit={canEdit} />
      </SectionCard>

      <SectionCard title="Status updates">
        <CRAUpdatesSection
          projectId={project.id}
          updates={updates}
          canEdit={canEdit}
        />
      </SectionCard>

      <SectionCard title="Documents">
        <CRADocumentsSection
          projectId={project.id}
          documents={documents}
          positionId={position.id}
          canEdit={canEdit}
        />
      </SectionCard>
    </div>
  );
}
