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

The e2e database has several adjourned meetings with an empty or absent `minutes_content`,
including multiple adjourned rows sharing a single `meeting_date`. That pattern suggests the
meeting runner is being opened and adjourned more than once per meeting, which is worth
understanding before choosing a fix — a hard block on the *second* adjournment of a duplicate row
would be annoying, not helpful.

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
3. Does an empty agenda scaffold count as minutes? `hasMinutesContent()` already strips tags, so a
   scaffold of empty headings reads as blank — confirm that is the desired rule.

## Starting points

- `actions/meetings.ts:453` — `adjournMeeting`
- `components/hoa/MeetingRunnerModal.tsx` — the adjourn control
- `lib/minutes.ts` — `hasMinutesContent()`, the existing "are there real minutes" test
- `app/(dashboard)/minutes/page.tsx` — where the gaps are already surfaced
