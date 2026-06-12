-- supabase/migrations/0018_treasury_schema.sql

create table fiscal_years (
  id                         uuid primary key default gen_random_uuid(),
  label                      text not null,
  start_date                 date not null,
  end_date                   date not null,
  default_assessment_amount  integer not null,
  status                     text not null default 'draft'
                               check (status in ('draft', 'approved')),
  created_at                 timestamptz not null default now()
);

create table budget_line_items (
  id              uuid primary key default gen_random_uuid(),
  fiscal_year_id  uuid not null references fiscal_years(id) on delete cascade,
  gl_code         text not null,
  description     text not null,
  category        text not null,
  account_type    text not null
                    check (account_type in (
                      'operating_income','operating_expense',
                      'reserve_income','reserve_expense'
                    )),
  budget_amount   integer not null,
  unique (fiscal_year_id, gl_code)
);

create table budget_monthly_amounts (
  id                   uuid primary key default gen_random_uuid(),
  budget_line_item_id  uuid not null references budget_line_items(id) on delete cascade,
  month_start          date not null,
  amount               integer not null,
  unique (budget_line_item_id, month_start)
);

create table budget_category_actuals (
  id                    uuid primary key default gen_random_uuid(),
  fiscal_year_id        uuid not null references fiscal_years(id) on delete cascade,
  category              text not null,
  account_type          text not null
                          check (account_type in (
                            'operating_income','operating_expense',
                            'reserve_income','reserve_expense'
                          )),
  as_of_date            date not null,
  ytd_actual            integer not null,
  entered_by_position_id uuid not null references positions(id),
  entered_at            timestamptz not null default now(),
  unique (fiscal_year_id, category, account_type, as_of_date)
);

create table cash_balances (
  id                    uuid primary key default gen_random_uuid(),
  fiscal_year_id        uuid not null references fiscal_years(id) on delete cascade,
  as_of_date            date not null,
  operating_balance     integer not null,
  reserve_balance       integer not null,
  entered_by_position_id uuid not null references positions(id),
  entered_at            timestamptz not null default now()
);

create table assessment_payments (
  id                    uuid primary key default gen_random_uuid(),
  property_id           uuid not null references properties(id) on delete cascade,
  fiscal_year_id        uuid not null references fiscal_years(id) on delete cascade,
  status                text not null default 'unpaid'
                          check (status in ('paid','partial','unpaid','waived')),
  amount_due            integer not null,
  amount_paid           integer not null default 0,
  payment_reference     text,
  paid_at               date,
  notes                 text,
  entered_by_position_id uuid references positions(id),
  entered_at            timestamptz not null default now(),
  unique (property_id, fiscal_year_id)
);

-- Enable RLS
alter table fiscal_years enable row level security;
alter table budget_line_items enable row level security;
alter table budget_monthly_amounts enable row level security;
alter table budget_category_actuals enable row level security;
alter table cash_balances enable row level security;
alter table assessment_payments enable row level security;

-- Helper: returns true if the current user can edit treasury data
-- (president, officer, or Treasurer position)
create or replace function is_treasury_editor()
returns boolean language sql security definer as $$
  select exists (
    select 1 from positions
    where email = auth.email()
    and (role in ('president','officer') or name = 'treasurer')
  );
$$;

-- fiscal_years: all authenticated can read; treasury editors can write
create policy "fy_read" on fiscal_years for select to authenticated using (true);
create policy "fy_write" on fiscal_years for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- budget_line_items
create policy "bli_read" on budget_line_items for select to authenticated using (true);
create policy "bli_write" on budget_line_items for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- budget_monthly_amounts
create policy "bma_read" on budget_monthly_amounts for select to authenticated using (true);
create policy "bma_write" on budget_monthly_amounts for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- budget_category_actuals
create policy "bca_read" on budget_category_actuals for select to authenticated using (true);
create policy "bca_write" on budget_category_actuals for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- cash_balances
create policy "cb_read" on cash_balances for select to authenticated using (true);
create policy "cb_write" on cash_balances for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- assessment_payments: voting members can read; treasury editors can write
create policy "ap_read" on assessment_payments for select to authenticated
  using (
    exists (
      select 1 from positions
      where email = auth.email()
      and role in ('president', 'officer', 'member')
    )
  );
create policy "ap_write" on assessment_payments for all to authenticated
  using (is_treasury_editor()) with check (is_treasury_editor());

-- Grants (required for tables created after initial "grant all" snapshot)
grant all on fiscal_years to anon, authenticated, service_role;
grant all on budget_line_items to anon, authenticated, service_role;
grant all on budget_monthly_amounts to anon, authenticated, service_role;
grant all on budget_category_actuals to anon, authenticated, service_role;
grant all on cash_balances to anon, authenticated, service_role;
grant all on assessment_payments to anon, authenticated, service_role;
