-- Allow account holders to append evidence of renewed acceptance.
-- Existing records remain immutable: there are deliberately no update or delete policies.
drop policy if exists "Users can record own legal acceptances" on public.legal_acceptances;
create policy "Users can record own legal acceptances"
  on public.legal_acceptances for insert
  with check (
    auth.uid() = user_id
    and accepted_at <= timezone('utc'::text, now()) + interval '5 minutes'
  );
