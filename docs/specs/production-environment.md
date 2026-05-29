# Production Environment

Deploy to a real URL with a separate Supabase project for prod data.

## Status
Not started. Currently using the single dev Supabase instance for everything.

---

## Plan

### 1. Separate Supabase projects
| Environment | Supabase project | Vercel target |
|---|---|---|
| Dev | Current project (existing) | Vercel preview deployments |
| Prod | New project (to create) | Vercel production deployment |

Steps:
1. Create a new Supabase project in the dashboard
2. Run all 6 migrations in order in the new project's SQL editor
3. Run `pnpm seed` against the new project to create the 8 position accounts
4. Copy the legacy API keys (not the new `sb_publishable_` format)

### 2. Vercel environment variables
Set per-environment in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Preview deployments use dev values; production deployment uses prod values.

### 3. Custom subdomain
Domain: `board.eastspringlake.com`

Steps:
1. Add `board.eastspringlake.com` as a custom domain in Vercel project settings
2. In DNS (wherever `eastspringlake.com` is managed): add a CNAME record
   `board → cname.vercel-dns.com`
3. Vercel handles SSL automatically

No gateway or reverse proxy needed — the existing `eastspringlake.com` site is unaffected
since subdomains are independent.

### 4. Seed prod accounts
After creating the prod Supabase project, run `pnpm seed` with prod env vars to create
the 8 position accounts. Distribute credentials to board members.

## Open questions
- Should preview deployments point at dev Supabase or a third staging project?
- Do we want Vercel password protection on preview deployments (since they're public)?
- When to go live — before or after the meeting runner is built?
