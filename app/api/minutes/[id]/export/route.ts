import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDocx } from "@/lib/docx";

/**
 * GET /api/minutes/[id]/export
 *
 * Fetches the minutes record, converts the HTML content to a .docx file,
 * and returns it as a file download. Authentication required.
 *
 * Minutes are also auto-uploaded to Supabase Storage on save; this route
 * provides an on-demand download for the secretary's convenience.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: minutes, error } = await supabase
    .from("meeting_minutes")
    .select("meeting_date, content")
    .eq("id", id)
    .single();

  if (error || !minutes) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!minutes.content) {
    return NextResponse.json({ error: "No content to export" }, { status: 400 });
  }

  const docxBuffer = await generateDocx(minutes.content);
  const filename = `minutes_${minutes.meeting_date}.docx`;

  return new NextResponse(Buffer.from(docxBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
