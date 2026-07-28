-- Let coaches delete live match tags (e.g. duplicates from a mis-timed recording).
create policy "Coaches can delete own live match tags" on public.live_match_tags for delete
  using (match_id in (select id from public.matches where coach_id = auth.uid()));

notify pgrst, 'reload schema';
