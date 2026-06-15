import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isChair } from "@/lib/permissions";
import { NewArchitectureRequestForm } from "./NewArchitectureRequestForm";

export const metadata = {
  title: "New Architecture Request — HOA Board",
};

/**
 * New architecture request page. Voting members (president, officer, member) submit a
 * homeowner's request via NewArchitectureRequestForm. Committee chairs are redirected to
 * their own office — they work with architecture items through /committee/[chair], not here.
 */
export default async function NewArchitectureRequestPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentPosition } = await supabase
    .from("positions")
    .select("name, role")
    .eq("email", user.email!)
    .single();

  if (!currentPosition) redirect("/login");
  if (isChair(currentPosition.role)) redirect(`/committee/${currentPosition.name}`);

  return <NewArchitectureRequestForm />;
}
