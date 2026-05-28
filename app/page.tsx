import { redirect } from "next/navigation";

/**
 * Root route — redirects to the dashboard.
 * The dashboard layout handles auth and redirects to /login if unauthenticated.
 */
export default function RootPage() {
  redirect("/dashboard");
}
