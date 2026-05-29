-- Meeting runner additions: attendance tracking on meetings + due_date/meeting linkage on todos.

alter table meetings add column present_positions uuid[] default '{}';

alter table todos
  add column due_date date,
  add column meeting_id uuid references meetings(id) on delete set null;
