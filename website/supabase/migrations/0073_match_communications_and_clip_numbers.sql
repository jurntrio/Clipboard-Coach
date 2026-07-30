-- Public match presentation, sponsor entitlement and stable numbers for new clips.
alter table public.matches
  add column if not exists public_location text,
  add column if not exists show_public_location boolean not null default false,
  add column if not exists sponsor_source text not null default 'none'
    check (sponsor_source in ('none', 'club', 'team')),
  add column if not exists sponsor_caption text;

alter table public.clips
  add column if not exists display_number integer;

-- Existing clips intentionally remain unnumbered. New clips receive a permanent,
-- monotonically increasing number within their match.
create or replace function public.assign_clip_display_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_match_id uuid;
begin
  if new.display_number is not null then return new; end if;
  select mv.match_id into target_match_id
  from public.match_videos mv
  where mv.video_id = new.video_id
  order by mv.created_at asc
  limit 1;
  if target_match_id is null then return new; end if;

  perform pg_advisory_xact_lock(hashtextextended(target_match_id::text, 0));
  select coalesce(max(c.display_number), 0) + 1 into new.display_number
  from public.clips c
  join public.match_videos mv on mv.video_id = c.video_id
  where mv.match_id = target_match_id;
  return new;
end;
$$;

drop trigger if exists assign_clip_display_number_before_insert on public.clips;
create trigger assign_clip_display_number_before_insert
before insert on public.clips
for each row execute function public.assign_clip_display_number();

-- Sponsoring is an optional paid club capability controlled by the platform
-- administrator. It is enabled for existing and newly created clubs by default.
alter table public.clubs
  alter column clip_advertising_enabled set default true;

-- Remove the former bundled placeholder: an unconfigured sponsor is blank.
update public.clubs
set general_sponsor_url = null
where general_sponsor_url = '/branding/clip-sponsors.png';

notify pgrst, 'reload schema';
