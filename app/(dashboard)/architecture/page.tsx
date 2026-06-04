import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { StatusBadge } from "@/components/hoa/StatusBadge";
import { EmptyState } from "@/components/hoa/EmptyState";
import { VoteForm } from "@/components/hoa/VoteForm";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { ArchitectureRequest } from "@/types/database";

export const metadata = {
  title: "Architecture — HOA Board",
};

/**
 * Board-wide architecture requests page.
 * All board members see the full request list with status badges.
 * The president additionally sees an inline VoteForm on each pending item.
 * "Submit New Request" links to the upload form at /architecture/new.
 * Chairs are redirected to their committee page (consistent with all other dashboard pages).
 */
export default async function ArchitecturePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [positionResult, requestsResult] = await Promise.all([
    supabase.from("positions").select("id, name, role").eq("email", user.email!).single(),
    supabase
      .from("architecture_requests")
      .select("id, address, description, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const position = positionResult.data;
  if (!position) redirect("/login");
  if (isChair(position.role)) redirect(`/committee/${position.name}`);

  const requests = (requestsResult.data ?? []) as Pick<
    ArchitectureRequest,
    "id" | "address" | "description" | "status" | "created_at"
  >[];

  const isPresident = position.role === "president";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Architecture Requests"
        subtitle="Homeowner architecture and modification requests"
        action={
          <Button size="sm" nativeButton={false} render={<Link href="/architecture/new" />}>
            Submit New Request
          </Button>
        }
      />

      <SectionCard
        title={`${requests.length} request${requests.length === 1 ? "" : "s"}`}
      >
        {requests.length === 0 ? (
          <EmptyState title="No architecture requests on file." />
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((req) => (
              <li key={req.id} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{req.address}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {req.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={req.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/architecture/${req.id}`} />}
                    >
                      View
                    </Button>
                  </div>
                </div>
                {isPresident && req.status === "pending" && (
                  <div className="mt-3">
                    <VoteForm requestId={req.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
