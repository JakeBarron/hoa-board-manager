# External Services

Services this app depends on, with free tier limits and upgrade triggers.

---

## Supabase
**Used for:** Postgres database, Auth (sessions, password reset), file storage

| Plan | Cost | Limits |
|---|---|---|
| Free | $0 | 500 MB DB, 5 GB bandwidth, 50 MB storage, 50,000 MAU, 2 projects |
| Pro | $25/mo | 8 GB DB, 250 GB bandwidth, 100 GB storage, 100,000 MAU |

**Upgrade trigger:** DB approaching 500 MB, or active users > 50,000 (not a concern for an HOA), or need for daily backups (Pro includes 7-day PITR).

---

## Vercel
**Used for:** Hosting, serverless functions, CI/CD preview deployments

| Plan | Cost | Limits |
|---|---|---|
| Hobby | $0 | Personal/non-commercial use only. 100 GB bandwidth, 6,000 build minutes/mo |
| Pro | $20/mo/member | Commercial use, 1 TB bandwidth, advanced analytics, password-protected previews |

**Upgrade trigger:** If this app is ever used commercially (HOA charging dues → arguably commercial), the Hobby plan terms require upgrading to Pro. Also needed for team collaboration or SLA guarantees.

---

## Resend
**Used for:** Transactional email delivery (password reset)

| Plan | Cost | Limits |
|---|---|---|
| Free | $0 | 3,000 emails/month, 100/day, 1 domain |
| Pro | $20/mo | 50,000 emails/month, multiple domains, webhooks |

**Upgrade trigger:** > 3,000 password reset emails/month (extremely unlikely for an HOA board of 13). Pro is only needed if this scales to a multi-tenant platform.

---

## Google Drive
**Used for:** Storage for meeting minutes documents (Drive URLs stored in DB)

| Plan | Cost | Limits |
|---|---|---|
| Personal (15 GB) | $0 | Shared across Gmail, Drive, Photos |
| Google One 100 GB | $2.99/mo | — |

**Upgrade trigger:** Minutes documents approaching 15 GB of the shared Google account storage. At ~50–100 KB per .docx, that's tens of thousands of documents — not a practical concern.

---

## Notes
- All free tiers are sufficient for a single HOA board (13 accounts, low traffic).
- Vercel's Hobby plan terms are the most likely forcing function if this becomes a real product — review before any commercial use.
