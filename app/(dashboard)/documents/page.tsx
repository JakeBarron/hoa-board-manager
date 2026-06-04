import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditAll, isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import { DocumentUpload } from "@/components/hoa/DocumentUpload";
import type { Document, DocumentType, PositionRole } from "@/types/database";

export const metadata = {
  title: "Documents — HOA Board",
};

const TYPE_LABELS: Record<DocumentType, string> = {
  waiver: "Waivers",
  contract: "Contracts",
  other: "Other",
};

const TYPE_ORDER: DocumentType[] = ["waiver", "contract", "other"];

/**
 * Board document library. Lists all documents grouped by type with signed download links.
 * All authenticated board members and chairs can view; officer+ see the upload form.
 */
export default async function DocumentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: position } = await supabase
    .from("positions")
    .select("id, name, role")
    .eq("email", user.email!)
    .single();

  if (!position) redirect("/login");
  if (isChair(position.role as PositionRole)) redirect(`/committee/${position.name}`);

  const { data: docs } = await supabase
    .from("documents")
    .select("id, type, name, storage_path, created_at")
    .order("created_at", { ascending: false });

  const documents = (docs ?? []) as Pick<
    Document,
    "id" | "type" | "name" | "storage_path" | "created_at"
  >[];

  // Generate signed URLs for all documents in one batch call (1-hour TTL)
  const signedUrls = new Map<string, string>();
  if (documents.length > 0) {
    const { data: urlData } = await supabase.storage
      .from("documents")
      .createSignedUrls(documents.map((d) => d.storage_path), 3600);
    urlData?.forEach((entry, i) => {
      if (entry.signedUrl) signedUrls.set(documents[i].id, entry.signedUrl);
    });
  }

  const byType = new Map<DocumentType, typeof documents>();
  for (const type of TYPE_ORDER) {
    byType.set(type, documents.filter((d) => d.type === type));
  }

  const canUpload = canEditAll(position.role as PositionRole);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Board documents — waivers, contracts, and other records."
        action={
          canUpload ? (
            <DocumentUpload positionId={position.id} />
          ) : undefined
        }
      />

      {documents.length === 0 ? (
        <SectionCard title="Documents">
          <EmptyState
            title="No documents yet"
            description={
              canUpload
                ? "Upload the first document to get started."
                : "No documents have been uploaded yet."
            }
          />
        </SectionCard>
      ) : (
        TYPE_ORDER.filter((type) => (byType.get(type)?.length ?? 0) > 0).map(
          (type) => (
            <SectionCard key={type} title={TYPE_LABELS[type]}>
              <ul className="divide-y divide-border">
                {byType.get(type)!.map((doc) => {
                  const href = signedUrls.get(doc.id);
                  return (
                    <li key={doc.id} className="flex items-center gap-4 py-3 text-sm">
                      <span className="flex-1 font-medium">{doc.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-xs text-primary underline underline-offset-2 hover:text-foreground"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Unavailable
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </SectionCard>
          )
        )
      )}
    </div>
  );
}
