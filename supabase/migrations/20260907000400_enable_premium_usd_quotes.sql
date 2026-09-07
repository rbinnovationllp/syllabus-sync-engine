-- Allow the approved USD Premium catalogue through the same prepaid quote path as INR.
create or replace function public.premium_create_quote(p_org uuid,p_code text,p_interval text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c ai_education_premium_package_catalog; s ai_education_premium_subscriptions; listed integer; base integer; total integer;
begin
 if not exists(select 1 from org_members where org_id=p_org and user_id=auth.uid() and role::text in ('admin','super_admin','owner')) then raise exception 'PREMIUM_ADMIN_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,17));
 if p_interval not in ('monthly','annual') then raise exception 'PREMIUM_INTERVAL_INVALID'; end if;
 select * into c from ai_education_premium_package_catalog where code=p_code and active
 and (effective_from is null or effective_from<=now()) and (effective_to is null or effective_to>now()) for share;
 if not found or lower(c.currency) not in ('inr','usd') then raise exception 'PREMIUM_PACKAGE_UNAVAILABLE'; end if;
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
 values(p_org,p_interval,lower(c.currency),base,total-base,total,'pending_payment','razorpay',auth.uid(),jsonb_build_object('package_code',c.code,'package_label',c.label,'selected_grades',c.grades,'gst_rate',c.gst_rate,'gst_inclusive',c.gst_inclusive,'billing_mode','prepaid','pricing_source','package_catalog')) returning * into s;
 return to_jsonb(s);
end; $$;
revoke all on function public.premium_create_quote(uuid,text,text) from public,anon;
grant execute on function public.premium_create_quote(uuid,text,text) to authenticated;
