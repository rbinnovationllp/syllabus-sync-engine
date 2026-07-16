-- Paid pilot subscription refund and participation credit workflow.
-- The first two months must be recorded as a paid pilot, never as a free trial.

create table if not exists public.pilot_programs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.organizations(id) on delete cascade,
  school_name text,
  approval_status text not null default 'approved'
    check (approval_status in ('draft', 'approved', 'completed', 'cancelled', 'expired')),
  pilot_start_date date not null,
  pilot_end_date date not null,
  approved_plan_id text,
  monthly_base_amount_minor integer not null default 0 check (monthly_base_amount_minor >= 0),
  gst_amount_minor integer not null default 0 check (gst_amount_minor >= 0),
  gateway_charges_minor integer not null default 0 check (gateway_charges_minor >= 0),
  bank_charges_minor integer not null default 0 check (bank_charges_minor >= 0),
  other_deductions_minor integer not null default 0 check (other_deductions_minor >= 0),
  total_paid_minor integer not null default 0 check (total_paid_minor >= 0),
  currency text not null default 'inr',
  gst_treatment text not null default 'non_refundable'
    check (gst_treatment in ('non_refundable', 'refundable', 'manual_review')),
  refund_credit_eligibility_status text not null default 'eligible'
    check (refund_credit_eligibility_status in ('eligible', 'not_eligible', 'manual_review')),
  mou_reference text,
  mou_document_url text,
  internal_notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pilot_benefit_requests (
  id uuid primary key default gen_random_uuid(),
  pilot_program_id uuid not null references public.pilot_programs(id) on delete restrict,
  school_id uuid not null references public.organizations(id) on delete cascade,
  request_type text not null check (request_type in ('refund', 'credit')),
  status text not null default 'pending_company_approval'
    check (status in ('pending_company_approval', 'approved', 'rejected', 'clarification_required', 'on_hold', 'processing', 'processed', 'failed', 'cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  original_razorpay_payment_id text,
  total_paid_minor integer not null default 0 check (total_paid_minor >= 0),
  base_amount_minor integer not null default 0 check (base_amount_minor >= 0),
  gst_amount_minor integer not null default 0 check (gst_amount_minor >= 0),
  gateway_charges_minor integer not null default 0 check (gateway_charges_minor >= 0),
  bank_charges_minor integer not null default 0 check (bank_charges_minor >= 0),
  other_deductions_minor integer not null default 0 check (other_deductions_minor >= 0),
  company_adjusted_deductions_minor integer not null default 0 check (company_adjusted_deductions_minor >= 0),
  eligible_amount_minor integer not null default 0 check (eligible_amount_minor >= 0),
  approved_amount_minor integer check (approved_amount_minor is null or approved_amount_minor >= 0),
  company_adjustment_reason text,
  rejection_reason text,
  school_notes text,
  internal_notes text,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null default 'pilot_participation_credit',
  source_reference_id uuid references public.pilot_benefit_requests(id) on delete restrict,
  credit_amount_minor integer not null check (credit_amount_minor >= 0),
  used_amount_minor integer not null default 0 check (used_amount_minor >= 0),
  remaining_amount_minor integer not null check (remaining_amount_minor >= 0),
  currency text not null default 'inr',
  status text not null default 'active' check (status in ('active', 'exhausted', 'reversed', 'cancelled')),
  notes text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_credit_ledger_balance_valid check (used_amount_minor + remaining_amount_minor <= credit_amount_minor)
);

create table if not exists public.refund_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.organizations(id) on delete cascade,
  benefit_request_id uuid not null unique references public.pilot_benefit_requests(id) on delete restrict,
  payment_gateway text not null default 'razorpay',
  original_payment_id text,
  gateway_refund_id text,
  approved_refund_amount_minor integer not null check (approved_refund_amount_minor >= 0),
  currency text not null default 'inr',
  refund_status text not null default 'pending'
    check (refund_status in ('pending', 'initiated', 'processed', 'failed', 'reversed')),
  initiated_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  raw_gateway_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_adjustments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.organizations(id) on delete cascade,
  credit_ledger_id uuid not null references public.school_credit_ledger(id) on delete restrict,
  invoice_id text,
  amount_applied_minor integer not null check (amount_applied_minor > 0),
  notes text,
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists pilot_programs_school_idx on public.pilot_programs(school_id, created_at desc);
create index if not exists pilot_benefit_requests_status_idx on public.pilot_benefit_requests(status, requested_at desc);
create index if not exists pilot_benefit_requests_school_idx on public.pilot_benefit_requests(school_id, requested_at desc);
create index if not exists school_credit_ledger_school_idx on public.school_credit_ledger(school_id, status, created_at desc);
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'school_credit_ledger_source_reference_key'
      and conrelid = 'public.school_credit_ledger'::regclass
  ) then
    alter table public.school_credit_ledger
      add constraint school_credit_ledger_source_reference_key unique (source_reference_id);
  end if;
end $$;
create unique index if not exists school_credit_ledger_source_reference_uidx
  on public.school_credit_ledger(source_reference_id)
  where source_reference_id is not null;
create index if not exists refund_transactions_school_idx on public.refund_transactions(school_id, created_at desc);
create index if not exists credit_adjustments_ledger_idx on public.credit_adjustments(credit_ledger_id, applied_at desc);

grant select, insert, update on public.pilot_programs to authenticated;
grant select, insert, update on public.pilot_benefit_requests to authenticated;
grant select on public.school_credit_ledger to authenticated;
grant select on public.refund_transactions to authenticated;
grant select on public.credit_adjustments to authenticated;
grant all on public.pilot_programs to service_role;
grant all on public.pilot_benefit_requests to service_role;
grant all on public.school_credit_ledger to service_role;
grant all on public.refund_transactions to service_role;
grant all on public.credit_adjustments to service_role;

alter table public.pilot_programs enable row level security;
alter table public.pilot_benefit_requests enable row level security;
alter table public.school_credit_ledger enable row level security;
alter table public.refund_transactions enable row level security;
alter table public.credit_adjustments enable row level security;

drop policy if exists "Company super admins manage pilot programs" on public.pilot_programs;
create policy "Company super admins manage pilot programs"
on public.pilot_programs for all to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Schools read own pilot programs" on public.pilot_programs;
create policy "Schools read own pilot programs"
on public.pilot_programs for select to authenticated
using (public.is_org_member(school_id) or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Company super admins manage pilot benefit requests" on public.pilot_benefit_requests;
create policy "Company super admins manage pilot benefit requests"
on public.pilot_benefit_requests for all to authenticated
using (public.has_role(auth.uid(), 'super_admin'))
with check (public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Schools read own pilot benefit requests" on public.pilot_benefit_requests;
create policy "Schools read own pilot benefit requests"
on public.pilot_benefit_requests for select to authenticated
using (public.is_org_member(school_id) or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Schools read own credit ledger" on public.school_credit_ledger;
create policy "Schools read own credit ledger"
on public.school_credit_ledger for select to authenticated
using (public.is_org_member(school_id) or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Schools read own refunds" on public.refund_transactions;
create policy "Schools read own refunds"
on public.refund_transactions for select to authenticated
using (public.is_org_member(school_id) or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Schools read own credit adjustments" on public.credit_adjustments;
create policy "Schools read own credit adjustments"
on public.credit_adjustments for select to authenticated
using (public.is_org_member(school_id) or public.has_role(auth.uid(), 'super_admin'));

drop policy if exists "Service role manages pilot workflow" on public.pilot_programs;
create policy "Service role manages pilot workflow"
on public.pilot_programs for all to service_role using (true) with check (true);

drop policy if exists "Service role manages pilot requests" on public.pilot_benefit_requests;
create policy "Service role manages pilot requests"
on public.pilot_benefit_requests for all to service_role using (true) with check (true);

drop policy if exists "Service role manages credit ledger" on public.school_credit_ledger;
create policy "Service role manages credit ledger"
on public.school_credit_ledger for all to service_role using (true) with check (true);

drop policy if exists "Service role manages refund transactions" on public.refund_transactions;
create policy "Service role manages refund transactions"
on public.refund_transactions for all to service_role using (true) with check (true);

drop policy if exists "Service role manages credit adjustments" on public.credit_adjustments;
create policy "Service role manages credit adjustments"
on public.credit_adjustments for all to service_role using (true) with check (true);

drop trigger if exists trg_pilot_programs_touch on public.pilot_programs;
create trigger trg_pilot_programs_touch before update on public.pilot_programs
for each row execute function public.touch_updated_at();

drop trigger if exists trg_pilot_benefit_requests_touch on public.pilot_benefit_requests;
create trigger trg_pilot_benefit_requests_touch before update on public.pilot_benefit_requests
for each row execute function public.touch_updated_at();

drop trigger if exists trg_school_credit_ledger_touch on public.school_credit_ledger;
create trigger trg_school_credit_ledger_touch before update on public.school_credit_ledger
for each row execute function public.touch_updated_at();

drop trigger if exists trg_refund_transactions_touch on public.refund_transactions;
create trigger trg_refund_transactions_touch before update on public.refund_transactions
for each row execute function public.touch_updated_at();
