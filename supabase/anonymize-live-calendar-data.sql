-- One-off data fix: anonymize real names already present in `calendar_events`
-- on deployed databases.
--
-- The 0019_operating_calendar.sql migration source is anonymized in this PR, but
-- any database where 0019 already ran still holds the original values on the rows
-- it inserted. Run this in the Supabase SQL editor against BOTH e2e and prod.
--
-- Idempotent — matches the old values, so re-running affects nothing once applied.

-- Grounds flowers (Spring + Fall): responsible party "Gibbs" -> "Hartwell"
update calendar_events
set responsible_party = 'Hartwell'
where responsible_party = 'Gibbs';

-- Homeside "Annual backflow" note: "Christy → Adams" -> "Dana → Morgan"
update calendar_events
set notes = 'Dana → Morgan to schedule'
where notes = 'Christy → Adams to schedule';
