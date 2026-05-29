# Architecture Request Upload

Homeowners submit architecture approval requests; the board reviews and votes.

## Status
- `/architecture` list page: built (with vote recording for president)
- `/architecture/[id]` public detail page: built
- `/architecture/new` upload form: **stub only**

---

## `/architecture/new` — New request form

Any authenticated board member can create a request on behalf of a homeowner.

### Fields
| Field | Type | Notes |
|---|---|---|
| `address` | text | Homeowner's property address |
| `description` | textarea | What they want to do |
| Files | file upload (multiple) | Scanned forms, plans, material samples |

### File upload
- Bucket: `architecture-docs` (public read, authenticated write)
- Each file → `architecture_documents` row with `storage_path`, `file_name`, `doc_type`
- `doc_type`: `form | plan | sample | other` — board member classifies at upload
- Supabase Storage public URL used for display/download

### Server action
`createArchitectureRequest(address, description, files[])`:
1. Insert `architecture_requests` row (status defaults to `pending`)
2. For each file: upload to `architecture-docs` bucket, insert `architecture_documents` row
3. Redirect to `/architecture/[id]`

### Public detail page additions needed
- Currently shows file names only
- Should show download links once Storage is wired (public bucket URL)
- Vote details section already rendered when `approved | denied`

## Open questions
- Should the homeowner receive an email confirmation? (would require an email provider)
- Maximum file size / accepted MIME types?
- Should files be deletable by president, or immutable like votes?
