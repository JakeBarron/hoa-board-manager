-- Add storage_path to meetings for auto-uploaded minutes .docx on adjournment
ALTER TABLE meetings ADD COLUMN storage_path text;

-- Add storage_path to meeting_documents for amendment file uploads;
-- make drive_url nullable so new storage-backed records don't need a Drive URL
ALTER TABLE meeting_documents ADD COLUMN storage_path text;
ALTER TABLE meeting_documents ALTER COLUMN drive_url DROP NOT NULL;
ALTER TABLE meeting_documents ALTER COLUMN drive_url SET DEFAULT NULL;

-- Add storage_path to meeting_minutes for per-position minutes uploads
ALTER TABLE meeting_minutes ADD COLUMN storage_path text;

-- General document library for waivers, contracts, and other board documents
CREATE TABLE documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text        NOT NULL CHECK (type IN ('waiver', 'contract', 'other')),
  name         text        NOT NULL,
  storage_path text        NOT NULL,
  position_id  uuid        REFERENCES positions(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view documents
CREATE POLICY "documents_select" ON documents
  FOR SELECT TO authenticated USING (true);

-- All authenticated users can upload documents
CREATE POLICY "documents_insert" ON documents
  FOR INSERT TO authenticated WITH CHECK (true);

-- Only officers and president can delete documents
CREATE POLICY "documents_delete" ON documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM positions
      WHERE email = (auth.jwt() ->> 'email')
        AND role IN ('president', 'officer')
    )
  );

-- ─── Supabase Storage bucket ─────────────────────────────────────────────────
-- Create via Supabase Dashboard: Storage → New bucket
--   Name: documents  |  Public: OFF (private)
--
-- Then add Storage policies (Storage → Policies → documents bucket):
--   SELECT: authenticated users
--     USING: bucket_id = 'documents'
--   INSERT: authenticated users
--     WITH CHECK: bucket_id = 'documents'
--   DELETE: officer/president only
--     USING: bucket_id = 'documents'
--       AND EXISTS (
--         SELECT 1 FROM positions
--         WHERE email = (auth.jwt() ->> 'email')
--           AND role IN ('president', 'officer')
--       )
