-- Let coaches mark live match tags as processed once they've been turned into a clip.
alter table public.live_match_tags
  add column if not exists reviewed_at timestamp with time zone;

create policy "Coaches can update own live match tags" on public.live_match_tags for update
  using (match_id in (select id from public.matches where coach_id = auth.uid()))
  with check (match_id in (select id from public.matches where coach_id = auth.uid()));

notify pgrst, 'reload schema';
