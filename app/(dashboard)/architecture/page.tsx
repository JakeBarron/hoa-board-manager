import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { EmptyState } from "@/components/hoa/EmptyState";
import { VoteForm } from "@/components/hoa/VoteForm";
import { Button } from "@/components/ui/button";
import { canRecordVote } from "@/lib/permissions";
import type { ArchitectureRequest, Position } from "@/types/database";

export const metadata = { title: "Architecture Approvals — HOA Board" };

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
 * Architecture approvals list page.
 * Shows all architecture requests ordered newest-first with status badges.
 * Presidents see an inline "Record vote" form on pending requests.
 */
export default async function ArchitecturePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [positionResult, requestsResult] = await Promise.all([
    supabase
      .from("positions")
      .select("role")
      .eq("email", user.email!)
      .single(),
    supabase
      .from("architecture_requests")
      .select("id, address, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const position = positionResult.data as Pick<Position, "role"> | null;
  const requests = (requestsResult.data ?? []) as Pick<
    ArchitectureRequest,
    "id" | "address" | "status" | "created_at"
  >[];

  const userCanVote = position ? canRecordVote(position.role) : false;

  const newRequestButton = (
    <Button render={<Link href="/architecture/new" />}>New Request</Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Architecture Approvals"
        subtitle="Review and vote on homeowner architecture requests"
        action={newRequestButton}
      />

      <SectionCard title="All Requests" description={`${requests.length} total`}>
        {requests.length === 0 ? (
          <EmptyState
            title="No architecture requests yet"
            description="Create a new request to get started."
            action={
              <Button
                variant="outline"
                render={<Link href="/architecture/new" />}
              >
                New Request
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/architecture/${req.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {req.address}
                    </Link>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Submitted {formatDate(req.created_at)}
                  </p>
                </div>

                {userCanVote && req.status === "pending" && (
                  <div className="sm:ml-4 sm:shrink-0">
                    <VoteForm requestId={req.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
