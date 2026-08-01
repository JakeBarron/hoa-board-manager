import { EmptyState } from "@/components/hoa/EmptyState";
import { hasMinutesContent } from "@/lib/minutes";

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
 * The HTML is trusted: it is produced by the meeting runner's Tiptap editor and
 * writable only by authenticated officers under the `meetings` RLS update
 * policy. It is never accepted from homeowners or any anonymous source.
 *
 * @param content          - Raw minutes HTML, or null when no minutes exist
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
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
