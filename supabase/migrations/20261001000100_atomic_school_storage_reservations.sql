-- Reserve pending uploads in the same transaction as metadata creation. This closes
-- the race where simultaneous upload URL requests could exceed a tenant quota.
create or replace function public.reserve_school_storage_upload(
  p_id uuid, p_org uuid, p_user uuid, p_bucket text, p_key text, p_file_name text,
  p_content_type text, p_size_bytes bigint, p_category text, p_quota_bytes bigint,
  p_academic_year_id uuid default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare current_bytes bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_org::text, 0));
  select coalesce(sum(size_bytes), 0) into current_bytes from school_storage_objects
    where org_id = p_org and status in ('pending', 'active');
  if current_bytes + p_size_bytes > p_quota_bytes then
    raise exception 'STORAGE_QUOTA_EXCEEDED';
  end if;
  insert into school_storage_objects(id, org_id, uploaded_by, bucket, object_key, file_name, content_type, size_bytes, category, status, academic_year_id)
    values (p_id, p_org, p_user, p_bucket, p_key, p_file_name, p_content_type, p_size_bytes, p_category, 'pending', p_academic_year_id);
end;
$$;
revoke all on function public.reserve_school_storage_upload(uuid,uuid,uuid,text,text,text,text,bigint,text,bigint,uuid) from public, anon, authenticated;
grant execute on function public.reserve_school_storage_upload(uuid,uuid,uuid,text,text,text,text,bigint,text,bigint,uuid) to service_role;
