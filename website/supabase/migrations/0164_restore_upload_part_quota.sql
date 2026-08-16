-- Restore the multipart upload quota objects in environments where migration
-- history was present but the database objects themselves were missing.
create table if not exists public.api_rate_limits (
  user_id uuid references public.profiles(id) on delete cascade not null,
  operation text not null,
  window_started_at timestamp with time zone not null,
  request_count integer not null check (request_count >= 0),
  primary key (user_id, operation)
);

alter table public.api_rate_limits enable row level security;

create or replace function public.consume_upload_part_url_quota(requested_count integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_window timestamp with time zone := date_trunc('minute', timezone('utc'::text, now()));
  updated_count integer;
begin
  if current_user_id is null or requested_count < 1 or requested_count > 100 then
    return false;
  end if;

  insert into public.api_rate_limits (user_id, operation, window_started_at, request_count)
  values (current_user_id, 'multipart-part-url', current_window, requested_count)
  on conflict (user_id, operation) do update
  set window_started_at = case
        when api_rate_limits.window_started_at = current_window then api_rate_limits.window_started_at
        else current_window
      end,
      request_count = case
        when api_rate_limits.window_started_at = current_window then api_rate_limits.request_count + requested_count
        else requested_count
      end
  returning request_count into updated_count;

  return updated_count <= 500;
end;
$$;

revoke all on function public.consume_upload_part_url_quota(integer) from public;
grant execute on function public.consume_upload_part_url_quota(integer) to authenticated;

notify pgrst, 'reload schema';
