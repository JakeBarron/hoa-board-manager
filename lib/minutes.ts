/**
 * Returns true when a stored minutes HTML string contains readable text.
 *
 * A non-empty string is not enough on its own: Tiptap serializes an empty
 * document as `<p></p>`, and the meeting runner seeds `minutes_content` with an
 * agenda scaffold that can end up as nothing but empty tags. Markup, `&nbsp;`
 * entities, and surrounding whitespace are stripped before the check.
 *
 * @param content - Raw HTML from `meetings.minutes_content`, or null/undefined
 * @returns true when at least one non-whitespace character survives stripping
 */
export function hasMinutesContent(
  content: string | null | undefined
): boolean {
  if (!content) return false;
  const text = content
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return text.length > 0;
}
