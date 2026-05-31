import { redirect } from "next/navigation";

/**
 * The schedule meeting flow has moved inline to /meetings.
 * This redirect preserves any bookmarked or linked URLs.
 */
export default function NewMeetingPage() {
  redirect("/meetings");
}
