import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { SectionCard } from "@/components/hoa/SectionCard";
import type {
  ArchitectureRequest,
  ArchitectureDocument,
} from "@/types/database";

/**
 * Human-readable labels for vote outcome values.
 */
const VOTE_OUTCOME_LABELS: Record<
  NonNullable<ArchitectureRequest["vote_outcome"]>,
  string
> = {
  unanimous: "Unanimous",
  majority: "Majority",
  denied: "Denied",
};

/**
 * Human-readable labels for document type values.
 */
const DOC_TYPE_LABELS: Record<ArchitectureDocument["doc_type"], string> = {
  form: "Form",
  plan: "Plan",
  sample: "Sample",
  other: "Other",
};

/**
 * Formats an ISO date string as a locale-aware short date.
 *
 * @param iso - ISO 8601 date string
 * @returns A human-readable date string, e.g. "Jan 15, 2026"
 */
const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/**
 * Public architecture request detail page.
 * Accessible without authentication — intended for homeowner deep-link sharing.
 * The anon RLS policy on architecture_requests allows public SELECT.
 *
 * Shows address, description, status, submitted date, vote details (if resolved),
 * and a list of associated documents.
 */
export default async function ArchitectureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [requestResult, documentsResult] = await Promise.all([
    supabase
      .from("architecture_requests")
      .select(
        "id, address, description, status, vote_outcome, vote_ratio, notes, created_at"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("architecture_documents")
      .select("id, file_name, doc_type")
      .eq("request_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const request = requestResult.data as Pick<
    ArchitectureRequest,
    | "id"
    | "address"
    | "description"
    | "status"
    | "vote_outcome"
    | "vote_ratio"
    | "notes"
    | "created_at"
  > | null;

  if (!request) notFound();

  const documents = (documentsResult.data ?? []) as Pick<
    ArchitectureDocument,
    "id" | "file_name" | "doc_type"
  >[];

  const isResolved = request.status === "approved" || request.status === "denied";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link
        href="/architecture"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Architecture
      </Link>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {request.address}
          </h1>
          <StatusBadge status={request.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Submitted {formatDate(request.created_at)}
        </p>
      </div>

      {/* Description */}
      <SectionCard title="Description">
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {request.description}
        </p>
      </SectionCard>

      {/* Vote details — only shown once a decision has been recorded */}
      {isResolved && (
        <SectionCard title="Vote Details">
          <dl className="space-y-3 text-sm">
            {request.vote_outcome && (
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground w-28 shrink-0">
                  Outcome
                </dt>
                <dd className="text-foreground">
                  {VOTE_OUTCOME_LABELS[request.vote_outcome]}
                </dd>
              </div>
            )}
            {request.vote_ratio && (
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground w-28 shrink-0">
                  Vote ratio
                </dt>
                <dd className="text-foreground">{request.vote_ratio}</dd>
              </div>
            )}
            {request.notes && (
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground w-28 shrink-0">
                  Notes
                </dt>
                <dd className="text-foreground whitespace-pre-wrap">
                  {request.notes}
                </dd>
              </div>
            )}
          </dl>
        </SectionCard>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <SectionCard
          title="Documents"
          description={`${documents.length} file${documents.length === 1 ? "" : "s"}`}
        >
          <ul className="divide-y divide-border">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-foreground">{doc.file_name}</span>
                <span className="text-xs text-muted-foreground">
                  {DOC_TYPE_LABELS[doc.doc_type]}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
