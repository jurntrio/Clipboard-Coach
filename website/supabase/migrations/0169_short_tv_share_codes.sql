-- Short, human-friendly aliases for public clip links.
-- The original UUID token remains the actual access token and keeps working.

create or replace function public.generate_share_short_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  random_bytes bytea;
  candidate text;
  position integer;
begin
  loop
    random_bytes := extensions.gen_random_bytes(8);
    candidate := '';
    for position in 0..7 loop
      candidate := candidate || substr(alphabet, (get_byte(random_bytes, position) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (
      select 1 from public.share_links where short_code = candidate
    );
  end loop;
  return candidate;
end;
$$;

alter table public.share_links
  add column short_code text default public.generate_share_short_code();

alter table public.share_links
  alter column short_code set not null,
  add constraint share_links_short_code_key unique (short_code),
  add constraint share_links_short_code_format check (short_code ~ '^[2-9A-HJ-NP-Z]{8}$');

comment on column public.share_links.short_code is
  'Human-friendly public alias used by /tv/CODE; excludes ambiguous I, O, 0 and 1.';

revoke all on function public.generate_share_short_code() from public, anon, authenticated;
