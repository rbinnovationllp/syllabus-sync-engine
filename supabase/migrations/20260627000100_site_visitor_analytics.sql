-- Lightweight first-party visitor analytics for Syllabus Synk.
-- Stores only basic page view metadata. No school operating data, student data, or private content is collected.

create table if not exists public.site_page_views (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  path text not null,
  page_title text,
  referrer text,
  user_agent text,
  screen_width integer,
  screen_height integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_page_views_created_at on public.site_page_views(created_at desc);
create index if not exists idx_site_page_views_path on public.site_page_views(path);
create index if not exists idx_site_page_views_visitor_id on public.site_page_views(visitor_id);

alter table public.site_page_views enable row level security;

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
