# Require Minutes on Adjournment

**Status:** Not started — brief only, no build scheduled.
**Raised by:** Jake (president), 2026-08-01, while reviewing the new `/minutes` archive.

---

## Problem

A meeting can be adjourned with no minutes body, and nothing stops it or flags it afterward.
`adjournMeeting` (`actions/meetings.ts:453`) sets `status = 'adjourned'` first, then checks
`minutes_content` only to decide whether to generate the `.docx`:

```ts
if (!meeting?.minutes_content) {
  revalidatePath(...);
  return { uploadError: null };   // adjourns fine, no minutes, no warning
}
```

So an empty meeting adjourns successfully and silently. The board ends up with a meeting in the
permanent record that has no account of what happened — which for an HOA is the one artifact that
actually matters.

The `/minutes` archive now marks these rows "No minutes on file" rather than hiding them, so the
gaps are at least *visible*. This spec covers preventing them.

## Evidence

Measured against the e2e database on 2026-08-02 — 13 adjourned meetings:

| State | Count | Detected by `hasMinutesContent`? |
|---|---|---|
| Real minutes typed by the secretary | 8 | yes |
| `minutes_content = ''` (never opened in the runner) | 2 | yes — marked |
| **Untouched agenda scaffold** | **3** | **no — counted as having minutes** |

The third row is the problem, and it is the *common* case: it is what a meeting that was opened in
the runner and adjourned without a word typed actually looks like. `buildMeetingScaffold`
(`lib/agenda.ts:116`) emits literal prose for every section, so those rows are ~450–750 characters
of text with nothing in them:

```html
<h2>Call to Order</h2><p>Called to order by Grounds — Jamie, seconded by Membership.</p>
<p>Present: … Quorum met.</p>
<h2>Board Reports</h2><h3>President</h3><p>—</p><h3>Vice President</h3><p>—</p> …
<h2>New Business</h2><p><em>None.</em></p><h2>Adjournment</h2><p></p>
```

So `/minutes` currently reports "2 of 13 … have no minutes on file" when the truthful figure is 5
of 13, and it renders an empty scaffold as the official record with no marker.

Note the placeholder text has already drifted once — older rows say `<em>No update submitted.</em>`
where current ones say `—`. Any detection built on matching boilerplate strings will rot the next
time `lib/agenda.ts` changes. Prefer an exact signal: have `seedMeetingScaffold`
(`actions/meetings.ts:218`) record what it seeded (a `meetings.scaffold_hash` column, say), so
"has real minutes" becomes `minutes_content` differing from the seeded scaffold — no string
matching, no drift. That needs a migration, which is why it belongs here rather than in the
read-only view.

The e2e data also has multiple adjourned rows sharing a single `meeting_date` (three on 2026-06-16,
two on 2026-07-21). That suggests the runner is being opened and adjourned more than once per
meeting, which is worth understanding before choosing a fix — a hard block on the *second*
adjournment of a duplicate row would be annoying, not helpful.

## Approaches

**A. Block adjournment (server-side).** `adjournMeeting` throws when `hasMinutesContent()` is
false, before the status update. Strongest guarantee, and it holds no matter which caller triggers
it. Risk: a real meeting that ran long and genuinely has nothing typed yet cannot be closed out,
so it needs a deliberate override path.

**B. Confirm in the runner (client-side).** `MeetingRunnerModal` warns on adjourn — "No minutes
have been written. Adjourn anyway?" — and records the choice. Cheapest and least disruptive, but
it is only a speed bump and does nothing for any other code path.

**C. Warn + track.** Adjourn proceeds, but the meeting is flagged (e.g. `minutes_missing`) and
surfaced as an outstanding item on `/dashboard` and `/minutes` until someone fills it in. Treats
missing minutes as a to-do rather than an error, which matches how a volunteer board actually
works.

**Recommendation:** B + C together, and treat A as a later tightening if gaps keep appearing. The
runner confirm catches the common accidental case immediately; the dashboard nag makes the gap
impossible to forget. A hard block is the right end state but should not land before the duplicate
adjourned rows are understood.

## Open questions

1. Why do duplicate adjourned meetings exist on the same date? Fix that first — it may be the real
   source of the empty rows.
2. Should the president/secretary be able to add minutes to an already-adjourned meeting? There is
   no UI for that today, and any of these approaches needs one as the escape hatch.
3. Does a scaffold carrying only submitted *pre-meeting updates* count as minutes? A scaffold with
   all-placeholder bodies clearly does not. But if board members submitted updates and those got
   folded in, the document has genuine content even though the secretary typed nothing during the
   meeting. The `scaffold_hash` approach above answers this automatically — the seeded scaffold
   already contains the updates, so only in-meeting edits count — but confirm that is the wanted
   rule.

## Starting points

- `actions/meetings.ts:453` — `adjournMeeting`
- `components/hoa/MeetingRunnerModal.tsx` — the adjourn control
- `lib/minutes.ts` — `hasMinutesContent()`, the existing "are there real minutes" test
- `app/(dashboard)/minutes/page.tsx` — where the gaps are already surfaced
