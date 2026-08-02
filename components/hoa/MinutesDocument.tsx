import { EmptyState } from "@/components/hoa/EmptyState";
import { hasMinutesContent } from "@/lib/minutes";
import { sanitizeMinutesHtml } from "@/lib/sanitize";

interface MinutesDocumentProps {
  /** Tiptap-authored HTML from `meetings.minutes_content`, or null when none is on file */
  content: string | null;
  /** Shown in the empty state so the reader knows why the page is blank */
  emptyDescription?: string;
}

/**
 * Read-only renderer for a meeting's minutes.
 *
 * Renders the stored HTML directly rather than mounting Tiptap, so the minutes
 * arrive as server HTML — selectable, printable, and free of editor JavaScript.
 * Typography comes from the shared `.rich-text` rules in `app/globals.css`.
 *
 * **Server-only** — `sanitizeMinutesHtml` is a Node module. The content is NOT
 * trusted: `meetings` RLS lets any of the 13 authenticated positions write
 * `minutes_content` through the REST API without going near Tiptap, so it is
 * run through an allowlist before injection. See `lib/sanitize.ts`.
 *
 * @param content          - Untrusted minutes HTML, or null when no minutes exist
 * @param emptyDescription - Optional explanation rendered in the empty state
 */
export function MinutesDocument({
  content,
  emptyDescription,
}: MinutesDocumentProps) {
  if (!content || !hasMinutesContent(content)) {
    return (
      <EmptyState
        title="No minutes on file"
        description={
          emptyDescription ??
          "Minutes are written during the meeting and appear here once the secretary saves them."
        }
      />
    );
  }

  return (
    <div
      className="rich-text text-sm"
      dangerouslySetInnerHTML={{ __html: sanitizeMinutesHtml(content) }}
    />
  );
}
