# CRA Projects

Capital Reserves Analysis project tracker. Officers+ can create/edit; members read-only.

## Status
Schema exists (migration 0001). List page and new page are stubs with `EmptyState`.

---

## Data model (already in DB)

```
cra_projects   — id, name, description, status, estimated_cost, created_by, created_at
cra_quotes     — id, project_id, vendor_name, amount, notes, document_url
cra_updates    — id, project_id, content, created_by_position, created_at (immutable)
cra_documents  — id, project_id, name, url, url_type (google_doc | storage_file)
```

Statuses: `proposed → approved → in_progress → complete | on_hold`

## Permissions
- **Officers + president**: create projects, add quotes, add updates, add documents
- **Members**: read-only across all CRA data

`canEditCRA(role)` in `lib/permissions.ts` already implements this.

## Pages to build

### `/cra` — Project list
- Table/card list of all projects ordered by status then created_at
- StatusBadge per project
- "New Project" button for officers+
- Clicking a project → `/cra/[id]`

### `/cra/new` — Create project
- Fields: name (required), description, estimated_cost, initial status (default `proposed`)
- Server action `createCRAProject`
- Officer+ only — redirect members to `/cra`

### `/cra/[id]` — Project detail
Three sections on one page:

**Header**: name, status badge, estimated cost, created by, dates. Status can be updated by officers+.

**Quotes table**: vendor name, amount, notes, optional document link. "Add quote" form inline (officer+). Quotes are not editable after creation.

**Status updates log**: chronological list of `cra_updates` entries. "Add update" textarea (officer+). Updates are immutable.

**Documents**: list of linked docs (Google Doc URLs or storage files). "Add document" form (officer+).

## Open questions
- Should members be able to comment on CRA projects (not just read)?
- Do quotes need an "accepted" flag to mark which vendor was chosen?
- File upload via Supabase Storage for quote documents, or Google Drive URL only?
