import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/hoa/PageHeader";
import { SectionCard } from "@/components/hoa/SectionCard";
import { EmptyState } from "@/components/hoa/EmptyState";
import { formatMeetingDate } from "@/lib/dates";
import type { ArchitectureRequest, CRAProject } from "@/types/database";

export const metadata = {
  title: "Dashboard — HOA Board",
};

/**
 * Main dashboard page.
 * Shows a quick summary of pending architecture requests and active CRA projects.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().split("T")[0];

  // Fetch summary data in parallel
  const [archResult, craResult, meetingResult] = await Promise.all([
    supabase
      .from("architecture_requests")
      .select("id, address, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("cra_projects")
      .select("id, name, status")
      .in("status", ["proposed", "approved", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("meetings")
      .select("meeting_date")
      .gte("meeting_date", today)
      .in("status", ["pending", "in_progress"])
      .order("meeting_date", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const pendingRequests = (archResult.data ?? []) as Pick<ArchitectureRequest, "id" | "address" | "status" | "created_at">[];
  const activeProjects = (craResult.data ?? []) as Pick<CRAProject, "id" | "name" | "status">[];
  const nextMeeting = meetingResult.data as { meeting_date: string } | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Welcome to the HOA Board Management Portal"
      />

      {/* Next meeting banner */}
      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
        {nextMeeting ? (
          <>
            <span className="font-medium">Next meeting: </span>
            <span>{formatMeetingDate(nextMeeting.meeting_date)}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <Link href="/agenda" className="text-primary hover:underline">
              View agenda
            </Link>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">No meeting scheduled.</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <Link href="/meetings" className="text-primary hover:underline">
              View meetings
            </Link>
          </>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Pending Architecture Requests"
          description={`${pendingRequests.length} awaiting review`}
        >
          {pendingRequests.length === 0 ? (
            <EmptyState title="No pending requests" />
          ) : (
            <ul className="space-y-2">
              {pendingRequests.map((req) => (
                <li key={req.id} className="text-sm">
                  <a
                    href={`/architecture/${req.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {req.address}
                  </a>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Active CRA Projects"
          description={`${activeProjects.length} in progress`}
        >
          {activeProjects.length === 0 ? (
            <EmptyState title="No active projects" />
          ) : (
            <ul className="space-y-2">
              {activeProjects.map((project) => (
                <li key={project.id} className="text-sm">
                  <a
                    href={`/cra/${project.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {project.name}
                  </a>
                  <span className="ml-2 text-xs capitalize text-muted-foreground">
                    {project.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
