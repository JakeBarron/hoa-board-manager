-- supabase/migrations/0013_properties_has_annual_lease_fee.sql
--
-- Some properties have an annual lease fee indicated by "Yes" in the membership
-- report rather than a dollar amount. Add a boolean flag to capture that signal
-- separately from the numeric amount column.

alter table properties
  add column has_annual_lease_fee boolean not null default false;
