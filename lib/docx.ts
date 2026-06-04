import HTMLtoDOCX from "html-to-docx";

/**
 * Converts an HTML string to a .docx buffer using standard HOA document formatting.
 *
 * @param htmlContent - HTML string to convert
 * @returns Uint8Array buffer suitable for file download or Supabase Storage upload
 */
export async function generateDocx(htmlContent: string): Promise<Uint8Array> {
  const buffer = await HTMLtoDOCX(htmlContent, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
    fontSize: 24,
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  });
  return new Uint8Array(buffer);
}
