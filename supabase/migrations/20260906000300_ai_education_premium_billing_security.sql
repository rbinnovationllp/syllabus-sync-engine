-- Independent prepaid AI Education Premium billing. No regular subscription or history is deleted.
begin;
alter table public.ai_education_premium_package_catalog
  add column gst_rate numeric(5,2) not null default 18 check (gst_rate between 0 and 100),
  add column gst_inclusive boolean not null default true,
  add column group_kind text not null default 'group' check (group_kind in ('group','school'));
update public.ai_education_premium_package_catalog set group_kind='school' where code in ('classes_1_5','classes_1_8','classes_1_10','classes_1_12');
alter table public.ai_education_premium_package_catalog add constraint premium_valid_grades check (
  grades <@ array['1','2','3','4','5','6','7','8','9','10','11','12']::text[]
  and array_position(grades,null) is null
);
alter table public.ai_education_premium_subscriptions
  add column provider_order_id text unique,
  add column order_creation_started timestamptz,
  add column tax_amount_minor integer not null default 0 check (tax_amount_minor >= 0),
  add column cancel_at_period_end boolean not null default false;
create table public.ai_education_premium_payments (
  provider_payment_id text primary key, subscription_id uuid not null references public.ai_education_premium_subscriptions(id),
  org_id uuid not null references public.organizations(id), provider_order_id text not null,
  amount_minor integer not null, currency text not null, status text not null check(status in ('captured','failed','refunded')),
  invoice_id text, paid_at timestamptz, created_at timestamptz not null default now()
);
alter table public.ai_education_premium_payments enable row level security;
create policy "School admins read Premium receipts" on public.ai_education_premium_payments for select to authenticated using (public.is_org_admin(org_id));

create function public.premium_has_class(p_org uuid, p_grade text, p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
 select exists (
  select 1 from org_members m where m.org_id=p_org and m.user_id=p_user
  and (m.role::text in ('admin','super_admin','owner') or exists (
   select 1 from ai_education_premium_teacher_assignments a where a.org_id=p_org and a.user_id=p_user and a.grade=p_grade and a.active
  ))
 ) and exists (
  select 1 from ai_education_premium_entitlements e join ai_education_premium_subscriptions s on s.id=e.subscription_id and s.org_id=e.org_id
  where e.org_id=p_org and e.grade=p_grade and e.status='active' and s.status in ('active','cancelled')
  and e.starts_at<=now() and e.ends_at>now() and s.starts_at<=now() and s.renews_at>now()
 );
$$;
revoke all on function public.premium_has_class(uuid,text,uuid) from public, anon;
grant execute on function public.premium_has_class(uuid,text,uuid) to authenticated, service_role;
drop policy "Org members read AI Education Premium plans" on public.ai_education_premium_teaching_plans;
create policy "Entitled teachers read Premium plans" on public.ai_education_premium_teaching_plans for select to authenticated using (public.premium_has_class(org_id,grade,auth.uid()));
-- Assignment must be within this school, even if an administrator uses the REST API directly.
drop policy "Org admins manage AI Education Premium teachers" on public.ai_education_premium_teacher_assignments;
create policy "Org admins manage AI Education Premium teachers" on public.ai_education_premium_teacher_assignments for all to authenticated
 using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id) and exists (select 1 from public.org_members m where m.org_id=ai_education_premium_teacher_assignments.org_id and m.user_id=ai_education_premium_teacher_assignments.user_id));

-- Authenticated quote creation snapshots database prices and grades in one transaction.
create function public.premium_create_quote(p_org uuid,p_code text,p_interval text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c ai_education_premium_package_catalog; s ai_education_premium_subscriptions; listed integer; base integer; total integer;
begin
 if not exists(select 1 from org_members where org_id=p_org and user_id=auth.uid() and role::text in ('admin','super_admin','owner')) then raise exception 'PREMIUM_ADMIN_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,17));
 if p_interval not in ('monthly','annual') then raise exception 'PREMIUM_INTERVAL_INVALID'; end if;
 select * into c from ai_education_premium_package_catalog where code=p_code and active
 and (effective_from is null or effective_from<=now()) and (effective_to is null or effective_to>now()) for share;
 if not found or lower(c.currency)<>'inr' then raise exception 'PREMIUM_PACKAGE_UNAVAILABLE'; end if;
 listed := case when p_interval='monthly' then c.monthly_price_inr else c.annual_price_inr end * 100;
 if listed<=0 then raise exception 'PREMIUM_PACKAGE_UNAVAILABLE'; end if;
 base := case when c.gst_inclusive then round(listed/(1+c.gst_rate/100)) else listed end;
 total := case when c.gst_inclusive then listed else base+round(base*c.gst_rate/100) end;
 -- Different overlapping packages would charge twice for some classes. Renew the same package or wait for expiry.
 if exists(select 1 from ai_education_premium_subscriptions x join ai_education_premium_entitlements e on e.subscription_id=x.id
 where x.org_id=p_org and x.status in ('active','cancelled') and x.renews_at>now() and e.grade=any(c.grades)
 and coalesce(x.metadata->>'package_code','')<>p_code) then raise exception 'PREMIUM_OVERLAPPING_COVERAGE'; end if;
 if exists(select 1 from ai_education_premium_subscriptions where org_id=p_org and status='active' and starts_at>now() and metadata->>'package_code'=p_code) then raise exception 'PREMIUM_RENEWAL_ALREADY_SCHEDULED'; end if;
 select * into s from ai_education_premium_subscriptions where org_id=p_org and status='pending_payment'
 and metadata->>'package_code'=p_code and billing_interval=p_interval and final_amount_minor=total
 and base_amount_minor=base and tax_amount_minor=total-base and metadata->'selected_grades'=to_jsonb(c.grades) and created_at>now()-interval '15 minutes' order by created_at desc limit 1;
 if found then return to_jsonb(s); end if;
 if (select count(*) from ai_education_premium_subscriptions where org_id=p_org and created_at>now()-interval '1 minute')>=5 then raise exception 'PREMIUM_CHECKOUT_RATE_LIMIT'; end if;
 insert into ai_education_premium_subscriptions(org_id,billing_interval,currency,base_amount_minor,tax_amount_minor,final_amount_minor,status,provider,created_by,metadata)
 values(p_org,p_interval,'inr',base,total-base,total,'pending_payment','razorpay',auth.uid(),jsonb_build_object('package_code',c.code,'package_label',c.label,'selected_grades',c.grades,'gst_rate',c.gst_rate,'gst_inclusive',c.gst_inclusive,'billing_mode','prepaid','pricing_source','package_catalog')) returning * into s;
 return to_jsonb(s);
end; $$;
revoke all on function public.premium_create_quote(uuid,text,text) from public,anon;
grant execute on function public.premium_create_quote(uuid,text,text) to authenticated;

-- Only the verified server can settle a payment. Row locks make duplicate webhooks harmless.
create function public.premium_settle_payment(p_order text,p_payment text,p_amount integer,p_currency text,p_invoice text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare s ai_education_premium_subscriptions; start_time timestamptz; end_time timestamptz;
begin
 select * into s from ai_education_premium_subscriptions where provider_order_id=p_order;
 if not found then raise exception 'PREMIUM_ORDER_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(s.org_id::text,17));
 select * into s from ai_education_premium_subscriptions where id=s.id for update;
 if p_amount<>s.final_amount_minor or lower(p_currency)<>s.currency then raise exception 'PREMIUM_PAYMENT_MISMATCH'; end if;
 if exists(select 1 from ai_education_premium_payments where provider_payment_id=p_payment and subscription_id=s.id and status='captured') then return s.id; end if;
 if s.status<>'pending_payment' then raise exception 'PREMIUM_ORDER_ALREADY_SETTLED'; end if;
 -- Paid renewals start after all currently paid coverage of the same package.
 select greatest(now(),coalesce(max(renews_at),now())) into start_time from ai_education_premium_subscriptions
 where org_id=s.org_id and status in ('active','cancelled') and metadata->>'package_code'=s.metadata->>'package_code';
 end_time:=start_time+case when s.billing_interval='annual' then interval '1 year' else interval '1 month' end;
 insert into ai_education_premium_payments(provider_payment_id,subscription_id,org_id,provider_order_id,amount_minor,currency,status,invoice_id,paid_at)
 values(p_payment,s.id,s.org_id,p_order,p_amount,lower(p_currency),'captured',p_invoice,now());
 update ai_education_premium_subscriptions set status='active', starts_at=start_time,renews_at=end_time,updated_at=now() where id=s.id;
 insert into ai_education_premium_entitlements(subscription_id,org_id,grade,status,starts_at,ends_at)
 select s.id,s.org_id,g,'active',start_time,end_time from jsonb_array_elements_text(s.metadata->'selected_grades') g
 on conflict(subscription_id,grade) do update set status='active',starts_at=excluded.starts_at,ends_at=excluded.ends_at;
 return s.id;
end; $$;
revoke all on function public.premium_settle_payment(text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.premium_settle_payment(text,text,integer,text,text) to service_role;

create table public.ai_education_premium_generation_jobs (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id),
 context_hash text not null, status text not null default 'running' check(status in ('running','complete','failed')), created_at timestamptz not null default now(),
 finished_at timestamptz, usage jsonb not null default '{}'::jsonb
);
create index premium_generation_usage_idx on public.ai_education_premium_generation_jobs(org_id,created_at);
alter table public.ai_education_premium_generation_jobs enable row level security;
create policy "Admins view Premium usage" on public.ai_education_premium_generation_jobs for select to authenticated using (public.is_org_admin(org_id));
create table public.ai_education_premium_usage_policy (
 id boolean primary key default true check(id), per_user_minute integer not null default 3 check(per_user_minute between 1 and 20),
 per_school_day integer not null default 30 check(per_school_day between 1 and 1000), per_school_month integer not null default 300 check(per_school_month between 1 and 20000)
);
insert into public.ai_education_premium_usage_policy(id) values(true);
alter table public.ai_education_premium_usage_policy enable row level security;
create policy "Super admins manage Premium usage limits" on public.ai_education_premium_usage_policy for all to authenticated using (public.has_role(auth.uid(),'super_admin')) with check(public.has_role(auth.uid(),'super_admin'));
create function public.premium_claim_generation(p_org uuid,p_user uuid,p_grade text,p_hash text) returns uuid
language plpgsql security definer set search_path=public as $$
declare limits ai_education_premium_usage_policy; job uuid;
begin
 if not premium_has_class(p_org,p_grade,p_user) then raise exception 'PREMIUM_CLASS_NOT_SUBSCRIBED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,23));
 if exists(select 1 from ai_education_premium_teaching_plans where org_id=p_org and context_hash=p_hash) then return null; end if;
 if exists(select 1 from ai_education_premium_generation_jobs where org_id=p_org and context_hash=p_hash and status='running' and created_at>now()-interval '90 seconds') then raise exception 'PREMIUM_GENERATION_IN_PROGRESS'; end if;
 select * into strict limits from ai_education_premium_usage_policy where id;
 if (select count(*) from ai_education_premium_generation_jobs where org_id=p_org and user_id=p_user and created_at>now()-interval '1 minute')>=limits.per_user_minute
 or (select count(*) from ai_education_premium_generation_jobs where org_id=p_org and created_at>=date_trunc('day',now()))>=limits.per_school_day
 or (select count(*) from ai_education_premium_generation_jobs where org_id=p_org and created_at>=date_trunc('month',now()))>=limits.per_school_month then raise exception 'PREMIUM_GENERATION_LIMIT'; end if;
 insert into ai_education_premium_generation_jobs(org_id,user_id,context_hash) values(p_org,p_user,p_hash) returning id into job;
 return job;
end; $$;
revoke all on function public.premium_claim_generation(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.premium_claim_generation(uuid,uuid,text,text) to service_role;
create function public.premium_revoke_refund(p_subscription uuid,p_payment text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from ai_education_premium_subscriptions where id=p_subscription for update;
 update ai_education_premium_payments set status='refunded' where subscription_id=p_subscription and provider_payment_id=p_payment;
 if not found then raise exception 'PREMIUM_PAYMENT_NOT_FOUND'; end if;
 update ai_education_premium_subscriptions set status='cancelled',renews_at=least(renews_at,now()),cancelled_at=now() where id=p_subscription;
 update ai_education_premium_entitlements set status='revoked',ends_at=least(ends_at,now()) where subscription_id=p_subscription;
end; $$;
revoke all on function public.premium_revoke_refund(uuid,text) from public,anon,authenticated;
grant execute on function public.premium_revoke_refund(uuid,text) to service_role;
commit;
