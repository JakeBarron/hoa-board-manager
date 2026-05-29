# Non-Voting Committee Chairs

CRA chair, website chair, and potentially others attend meetings and give updates
but do not hold voting board positions.

## Status
Not started. Currently the president types their updates as free-text notes.

---

## Problem
Committee chairs typically don't attend every meeting. When absent, someone else has
to relay their update. A login would let them submit pre-meeting updates directly, just
like board members.

## Proposed approach

### New role: `chair`
Add `chair` to the `positions.role` check constraint (new migration required).

Chairs get:
- Login access
- Read access to all board content (same as `member`)
- Can submit pre-meeting updates for their own section
- **Cannot** vote on motions
- **Cannot** edit minutes, todos, or other members' content

### New positions
Add rows to the `positions` table for committee chairs:
- `cra_chair` — Capital Reserves Analysis committee
- `website_chair` — HOA website/communications

The `positions.name` check constraint would need to be expanded (new migration).

### UI changes
- Sidebar: show chair positions under "Committee Chairs" section (hidden from non-chairs)
- Pre-meeting form: chair can submit update for their section
- Agenda page: include chair updates under a "Committee Reports" section after board reports
- Meeting runner: chair updates listed read-only; chair cannot propose/second/vote

### What stays the same
- 8 voting positions unchanged
- Quorum still counts only voting members (`role IN ('president', 'officer', 'member')`)
- `canRecordVote`, `canEditAll`, `canEditSection` functions unchanged

## Open questions
- How many committee chairs are there? (determines how many new position rows to add)
- Should chairs be able to create CRA projects, or just add updates to existing ones?
- Do chairs need their own sidebar section, or do they just appear as items under the pre-meeting form?
