-- Keep public visitor analytics working without exposing raw page-view rows.
-- Public visitors may record a page view and read aggregate counts only.

grant usage on schema public to anon, authenticated, service_role;
grant select, insert on public.site_page_views to service_role;
grant insert on public.site_page_views to anon, authenticated;
grant select on public.site_page_views to authenticated;

drop policy if exists "Public visitors can record site page views" on public.site_page_views;
create policy "Public visitors can record site page views"
on public.site_page_views
for insert
to anon, authenticated
with check (
  length(visitor_id) between 8 and 120
  and length(path) between 1 and 500
);

drop policy if exists "Super admins can read site page views" on public.site_page_views;
create policy "Super admins can read site page views"
on public.site_page_views
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'super_admin'
  )
);

create or replace function public.record_site_page_view(
  _visitor_id text,
  _path text,
  _page_title text default null,
  _referrer text default null,
  _user_agent text default null,
  _screen_width integer default null,
  _screen_height integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if _visitor_id is null or length(_visitor_id) < 8 or length(_visitor_id) > 120 then
    raise exception 'Invalid visitor_id';
  end if;

  if _path is null or length(_path) < 1 or length(_path) > 500 then
    raise exception 'Invalid path';
  end if;

  insert into public.site_page_views (
    visitor_id,
    path,
    page_title,
    referrer,
    user_agent,
    screen_width,
    screen_height
  )
  values (
    _visitor_id,
    _path,
    nullif(left(coalesce(_page_title, ''), 250), ''),
    nullif(left(coalesce(_referrer, ''), 500), ''),
    nullif(left(coalesce(_user_agent, ''), 500), ''),
    _screen_width,
    _screen_height
  );
end;
$$;

create or replace function public.get_site_visitor_counts(_since timestamptz default null)
returns table(visits bigint, visitors bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::bigint as visits,
    count(distinct visitor_id)::bigint as visitors
  from public.site_page_views
  where _since is null or created_at >= _since;
$$;

grant execute on function public.record_site_page_view(text, text, text, text, text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.get_site_visitor_counts(timestamptz) to anon, authenticated, service_role;
