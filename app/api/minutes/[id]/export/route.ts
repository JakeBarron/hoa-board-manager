import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import HTMLtoDOCX from "html-to-docx";

/**
 * GET /api/minutes/[id]/export
 *
 * Fetches the minutes record, converts the HTML content to a .docx file,
 * and returns it as a file download. Authentication required.
 *
 * The caller is responsible for uploading the downloaded file to Google Drive
 * and then saving the Drive URL back via the updateMinutesDriveUrl action.
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

  const docxBuffer = await HTMLtoDOCX(minutes.content, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
    fontSize: 24,
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  });

  const filename = `minutes_${minutes.meeting_date}.docx`;

  return new NextResponse(new Uint8Array(docxBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
