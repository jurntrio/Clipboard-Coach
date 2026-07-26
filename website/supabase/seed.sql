-- Lokale dev-pariteit met het echte gehoste Supabase-project.
--
-- Op het gehoste project krijgt "authenticated" bij projectaanmaak automatisch brede
-- tabel-grants op het public-schema (Supabase's eigen platform-bootstrap, niet iets dat in
-- deze migraties zelf zit). RLS-policies zijn overal de echte toegangsbeperking; de grants
-- zijn enkel de voorwaarde om RLS überhaupt te laten evalueren i.p.v. "permission denied".
--
-- Dit lokale project is nooit eerder via de Supabase CLI geïnitialiseerd (er was tot nu toe
-- geen supabase/config.toml), dus die bootstrap-grants ontbraken hier. Zonder dit bestand
-- faalt elke query van "authenticated" tegen tabellen als clubs/teams/club_memberships met
-- "permission denied for table ..." nog vóór RLS ook maar de kans krijgt de rijen te filteren
-- -- ongeacht of de policy zelf correct is. supabase/seed.sql draait automatisch na de
-- migraties bij `supabase db reset`, enkel lokaal (niet tegen productie).

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
