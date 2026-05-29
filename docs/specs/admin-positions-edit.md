# Admin — Position Reassignment

President-only tool to transfer a board position to a new member when terms change.

## Status
`/admin/positions` lists all positions and emails. Edit form shows "Edit coming soon."

---

## What needs building

### Inline edit form per position row
When president clicks "Edit" next to a position:
- Shows an email input pre-populated with the current email
- "Save" calls `reassignPosition(positionId, newEmail)` server action
- On success: updates the `positions.email` column

### `reassignPosition` server action
1. Verify caller is president (role check + RLS)
2. Check the new email doesn't already belong to another position
3. Update `positions.email` where `id = positionId`
4. The new person can now sign in with their email and the position's password
   (or trigger a Supabase password reset — see open questions)

### What this does NOT do
- Does not create or delete Supabase Auth users — position accounts are pre-seeded
- Does not change the password — president updates email; new member sets their own password via the Supabase reset flow or is given the existing one

## Open questions
- Should reassignment trigger a Supabase "invite user" email to the new address?
- Do we need an audit log of past reassignments (who held each position when)?
- Should there be a confirmation dialog before saving, since this is a destructive action on auth?
