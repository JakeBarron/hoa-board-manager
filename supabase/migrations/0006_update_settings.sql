-- Remove board_size (a DB constraint, not a runtime config) and add meeting_cadence.
-- meeting_cadence format: "week:dayOfWeek"
--   week       = 1-4 (ordinal) or 5 (last)
--   dayOfWeek  = 0 (Sun) through 6 (Sat)
-- Example: "3:2" = 3rd Tuesday of every month

delete from settings where key = 'board_size';

insert into settings (key, value, description) values (
  'meeting_cadence',
  '3:2',
  'Default meeting schedule as "week:dayOfWeek" (week 1-5 where 5=last; day 0=Sun … 6=Sat). Example: "3:2" = 3rd Tuesday.'
) on conflict (key) do nothing;
