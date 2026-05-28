-- Add secretary as a voting board position
-- The positions.name check constraint needs to be updated to include 'secretary'.
-- PostgreSQL auto-names unnamed constraints as <table>_<column>_check.

alter table positions drop constraint positions_name_check;
alter table positions add constraint positions_name_check
  check (name in ('president','vp','secretary','treasurer','pool','membership','tennis','social'));

-- Same update for cra_updates which also stores position names
alter table cra_updates drop constraint cra_updates_created_by_position_check;
alter table cra_updates add constraint cra_updates_created_by_position_check
  check (created_by_position in ('president','vp','secretary','treasurer','pool','membership','tennis','social'));
