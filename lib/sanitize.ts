import sanitizeHtml from "sanitize-html";

/**
 * Tags Tiptap StarterKit can produce. Anything outside this set is dropped.
 * Kept deliberately narrow — this is an allowlist, not a blocklist.
 */
const ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "strong",
  "em",
  "s",
  "br",
  "hr",
  "a",
];

/**
 * Strips every tag and attribute that Tiptap StarterKit cannot produce from a
 * stored minutes HTML string.
 *
 * **Server-only** — depends on `sanitize-html`, which is a Node module. Import
 * this from Server Components and Route Handlers, never from a Client Component.
 *
 * This is required, not defensive polish. `minutes_content` is not trustworthy:
 * the `meetings` RLS policies are `meetings_insert WITH CHECK (true)` and
 * `meetings_update USING (called_by = current_position().id OR is_president())`,
 * so *any* of the 13 authenticated positions — committee chairs included — can
 * insert a meeting naming themselves as `called_by` and then PATCH arbitrary
 * HTML into its `minutes_content` straight through the REST API, bypassing the
 * Tiptap editor entirely. Rendering that unsanitized into a Server Component
 * puts attacker-controlled markup in the initial SSR stream, where a literal
 * `<script>` executes on first paint. The app sets no CSP.
 *
 * Anchors are restricted to http/https/mailto so `javascript:` URLs cannot
 * survive, and `rel="noopener noreferrer"` is forced on any link that opens in
 * a new tab.
 *
 * @param html - Untrusted HTML from `meetings.minutes_content`
 * @returns The same document with only allowlisted tags and attributes left
 */
export function sanitizeMinutesHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    // Drop the contents of anything not allowlisted rather than hoisting the
    // inner text out of, say, a <script> body.
    nonTextTags: ["style", "script", "textarea", "option", "noscript"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}
