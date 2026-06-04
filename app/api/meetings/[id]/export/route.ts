import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDocx } from "@/lib/docx";

/**
 * GET /api/meetings/[id]/export
 *
 * Fetches the meeting record, converts the minutes_content HTML to a .docx file,
 * and returns it as a file download. Authentication required.
 *
 * The caller is responsible for uploading the downloaded file to Google Drive
 * and then saving the Drive URL back via saveMeetingDriveUrl.
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

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("meeting_date, minutes_content")
    .eq("id", id)
    .single();

  if (error || !meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!meeting.minutes_content) {
    return NextResponse.json({ error: "No content to export" }, { status: 400 });
  }

  const docxBuffer = await generateDocx(meeting.minutes_content);
  const filename = `minutes_${meeting.meeting_date}.docx`;

  return new NextResponse(Buffer.from(docxBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
