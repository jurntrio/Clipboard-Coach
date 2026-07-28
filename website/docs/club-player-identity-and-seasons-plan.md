# Club-brede spelersidentiteit, multi-team-lidmaatschap en seizoensbeheer

## Doel

Vandaag hoort een `players`-record bij precies één `teams`-rij (`players.team_id`, verplicht,
1-op-1). Dat botst met de praktijk bij een jeugdwerking zoals KM Torhout: een speler kan in
dezelfde week meespelen met U13A, U13B en soms U13C, zonder vaste indeling. Daarnaast schuiven
spelers elk seizoen door naar een oudere leeftijdscategorie, en dat gebeurt vandaag nergens
geautomatiseerd.

Dit plan maakt een speler een **club-brede, stabiele identiteit** (`club_players`) los van een
specifiek team, met een many-to-many-lidmaatschap per seizoen (`player_team_memberships`,
gekoppeld aan een echte `club_seasons`-tabel). Dat lost meteen ook het "ouder van een kind dat
in 2 teams speelt"-probleem op: één uitnodiging aan de club-brede speler geeft de ouder
automatisch zicht op alle teams/matches/clips van dat kind, gegroepeerd per team.

Dit plan **vervangt** het uitgangspunt van
[club-team-roster-plan.md](club-team-roster-plan.md) dat `players.team_id` 1-op-1 blijft ("geen
tweede spelersmodel"). De rest van dat document (clubteam ↔ operationeel team-koppeling,
`trainers_can_edit_roster`, autorisatiemodel) blijft geldig en orthogonaal aan dit plan.

Dit document doorliep 3 rondes uitgebreide architecturale review vóór implementatie van Fase 1;
de belangrijkste, definitieve ontwerpkeuzes staan hieronder. Het volledige, SQL-precieze
Fase 1-plan (zoals effectief geïmplementeerd) staat in
`website/supabase/migrations/0030_club_player_identity_schema.sql` en
`0031_backfill_club_player_identity.sql`.

## Kernprincipes (na review vastgelegd)

- **`player_team_memberships` is de canonieke bron** van teamlidmaatschap. `players` blijft
  bestaan als operationele projectielaag (tags/clips/matches blijven ernaar verwijzen) met
  precies één koppelpunt: `players.membership_id` (uniek, `on delete set null`). Er is **geen**
  aparte `players.club_player_id`-kolom — dat zou een tweede, mogelijk tegenstrijdige waarheid
  zijn.
- **Seizoen is een echte tabel** (`club_seasons`: naam, start/einddatum, `is_active`), geen
  vrije tekst. Activeren gaat via `set_active_club_season()` (transactioneel, voorkomt dat 2
  seizoenen tegelijk actief staan).
- **Matchsleutel** = genormaliseerde voornaam + achternaam + geboortedatum, per club. Normalisatie
  verwijdert accenten (`unaccent`, via een immutable wrapper), apostrofs, koppeltekens en
  spaties, zodat "Van den Berg"/"Vandenberg", "D'Haene"/"Dhaene", "Émile"/"Emile" e.d. correct
  samenvallen. Spelers zonder geboortedatum worden **nooit** automatisch samengevoegd (elke
  zo'n rij krijgt een eigen sleutel via zijn eigen `id`).
- **Clubgrenzen worden op databaseniveau afgedwongen**: een trigger controleert bij elke
  membership dat `club_player.club_id`, `team.club_id` én `season.club_id` alle drie gelijk
  zijn — een gewone foreign key zou dat niet garanderen.
- **Identiteitsvelden (naam, geboortedatum, contactgegevens) zijn club-admin-only.** Een
  trainer, ook met `trainers_can_edit_roster`, kan een bestaande `club_players`-rij nooit
  rechtstreeks bewerken — dat voorkomt dat een U13A-trainer de gegevens van een U17-speler kan
  aanpassen. Een trainer maakt een nieuwe clubspeler alleen via de team-gebonden RPC
  `create_club_player_with_membership()`.
- **Kijken en beheren zijn losse rechten.** `can_view_team_membership` (elke actief toegewezen
  trainer, ook zonder rosterrechten) versus `can_manage_team_membership` (enkel met
  `trainers_can_edit_roster` of club-admin). Een trainer zonder bewerkrecht kan zijn eigen
  teamspelers dus nog altijd zien.
- **Trainers zien geen clubbrede persoonsgegevens.** De SELECT-policy op `club_players` is
  beperkt tot spelers die de trainer effectief deelt via een eigen team-membership, niet alle
  spelers van de club.
- **`membership_type`** (`primary`/`secondary`/`guest`) onderscheidt een structureel
  teamlidmaatschap van een eenmalige invalbeurt. Ten hoogste 1 actieve `primary` per
  (club_player, seizoen), afgedwongen met een partiële unieke index.
- **Geen enkel automatisch geraden primair team.** Nieuwe memberships (ook via backfill)
  starten als `secondary`; enkel ondubbelzinnige 1-team-gevallen worden automatisch `primary`.
  Multi-team-gevallen komen in een reviewlijst (`club_player_migration_issues`,
  issue-type `unassigned_primary_team`) voor een bewuste keuze door de clubadmin.
- **`merge_club_players()` is club-admin-only**, gebruikt `auth.uid()` intern (geen
  meegegeven actor-parameter — voorkomt impersonatie) en **blokkeert volledig** bij een
  onopgeloste overlap (dezelfde team+seizoen-combinatie bij beide te fuseren spelers) in
  plaats van de overlap stilzwijgend te verwijderen.
- **Schema en backfill zijn gescheiden migraties.** `0030` is zuiver additief (schema, functies,
  RLS, geen datawijziging). `0031` bevat de daadwerkelijke backfill-functie en wordt pas
  toegepast na een dry-run-review van de productiedata (near-miss-rapport, ontbrekende
  geboortedatums) — nooit automatisch bij het uitrollen van `0030`.
- **Datumkwaliteit wordt bewaakt, niet afgedwongen.** `date_of_birth` blijft nullable; er komt
  geen NOT NULL-constraint. Ontbrekende of conflicterende gegevens verschijnen als reviewrijen
  in `club_player_migration_issues` in plaats van de backfill te laten falen.

## Fase 1 — Schema, seizoen, backfill (huidige implementatie)

Zie `0030_club_player_identity_schema.sql` (schema/RLS/functies) en
`0031_backfill_club_player_identity.sql` (backfill, apart toe te passen na review) voor de
exacte, geïmplementeerde SQL. Kernonderdelen: `club_seasons`, `club_players`,
`player_team_memberships`, `players.membership_id`, `club_player_migration_issues`,
`merge_club_players()`, `create_club_player_with_membership()`.

`teams.season_id` wordt in Fase 1 bewust **niet** toegevoegd: een operationeel `teams`-record
blijft voorlopig seizoenloos herbruikt, zoals vandaag.

## Fase 2 — PSD-import en team-toewijzing herzien

- **Drie importmodi**, nooit stilzwijgend spelers verwijderen bij een onvolledige export:
  - *Toevoegen/bijwerken* (standaard): voegt nieuwe spelers toe, werkt bestaande bij,
    verwijdert niemand.
  - *Roster synchroniseren*: ontbrekende spelers worden als "te verwijderen" **voorgesteld**,
    de gebruiker moet expliciet bevestigen welke uit het team mogen.
  - *Volledig vervangen*: enkel via een expliciete clubadmin-actie met bevestiging.
  - Importpreview toont altijd: X nieuw, Y bijgewerkt, Z ontbrekend-in-bestand.
- **Identiteitsvelden (naam, geboortedatum) alleen via een expliciete "identiteit
  bewerken"-actie** of een conflictmelding — nooit stilzwijgend overschreven door een import.
  Contactvelden (e-mail/telefoon/adres): een niet-lege importwaarde mag bijwerken, een lege
  importwaarde wist niets, een conflicterende niet-lege waarde verschijnt in de preview
  (spiegelt de `conflicting_contact_data`-logica die de Fase 1-backfill al gebruikt).
- Een naamcorrectie die botst met een bestaande `match_key` (unique-violation `23505`) is
  bedoeld gedrag: de UI vangt dit op en biedt `merge_club_players()` aan i.p.v. een generieke
  foutmelding.
- **"Voeg speler ook toe aan ander team"-actie**: gebruikt `search_club_players_for_assignment()`
  — een nieuwe, beperkte clubbrede zoek-RPC (naam, geboortejaar, huidige teamnamen; **geen**
  e-mail/telefoon/adres) zodat een trainer een kind kan vinden zonder de striktere Fase 1-RLS
  te moeten omzeilen. Volledige contactgegevens blijven pas zichtbaar zodra er een echte
  membership gedeeld wordt.
- UI-actie om `unassigned_primary_team`-reviewgevallen op te lossen (primair team kiezen).

## Fase 3 — Guardian-invite en parent-UI

- `player_invites`/`player_guardians` schakelen over op `club_player_id`. Eén uitnodiging dekt
  voortaan alle `players`-rijen die via hun `membership_id` naar dezelfde `club_player_id`
  wijzen.
- **Expliciete toegangsreikwijdte** i.p.v. impliciet "alles voor altijd": `player_guardians`
  krijgt `access_scope` (`current_season` / `from_acceptance` / `all_history`),
  `valid_from`/`valid_until`/`revoked_at`. Standaard voor de eerste club: toegang tot actieve
  en toekomstige memberships vanaf acceptatie; historische content buiten die scope enkel na
  expliciete toestemming.
- Duidelijk onderscheiden RLS-helpernaamgeving: `guardian_club_player_ids(user_id)` →
  `club_player_id`'s; `guardian_operational_player_ids(user_id)` → `players.id`'s (de vorige
  naam `guardian_club_player_ids` die eigenlijk `players.id` teruggaf was misleidend).
- **`ParentHome.tsx` navigeert primair via het kind, niet via de club**: bij één kind toont het
  Kind → Team → Match → Clips; bij meerdere kinderen krijgt elk kind zijn eigen sectie met
  dezelfde structuur eronder. Wanneer het platform later meerdere clubs per ouder ondersteunt,
  wordt dit Kind → Club → Team → Match → Clips.

## Fase 4 — Seizoen-kopieerwizard

- Geen kale "doorschuifactie" die enkel memberships aanmaakt, maar een volwaardige wizard:
  1. nieuw seizoen aanmaken;
  2. teams kopiëren of wijzigen;
  3. trainers kopiëren;
  4. spelers **voorstellen** per leeftijd (uit geboortejaar) — dit is altijd een voorstel, nooit
     een automatische A/B/C-toewijzing (uitzonderingen: speler een jaar hoger/lager, meisjes
     met afwijkende indeling, provinciale regels, samengevoegde teams, vertrekkende spelers);
  5. spelers over teams verdelen, clubadmin corrigeert uitzonderingen;
  6. conflicten en uitzonderingen controleren;
  7. seizoen activeren (via `set_active_club_season()`).
- **Harde randvoorwaarde vóór Fase 4 start**: geen operationele `players`-rijen voor een volgend
  seizoen aanmaken vóór óf (a) `teams` zelf seizoensgebonden is gemaakt (`teams.season_id`), óf
  (b) alle bestaande rosterqueries die nu op `players.team_id` filteren zijn omgezet naar
  filteren via `player_team_memberships.season_id`. Zonder een van beide zou één U13-team
  gelijktijdig spelers van 2 seizoenen tonen, omdat beide operationele `players`-rijen dezelfde
  `team_id` zouden delen.

## Risico's en aandachtspunten

- **Backfill-matching (Fase 1, `0031`) is eenmalig kritiek**: near-misses en ontbrekende
  geboortedatums worden gerapporteerd, nooit stilzwijgend samengevoegd of gedupliceerd —
  opgevolgd via `club_player_migration_issues`.
- **Levende productiedata** (KM Torhout heeft al teams/spelers/clips): `0030` is volledig
  additief en reversibel; `0031` draait pas na expliciete review, nooit automatisch.
- **Geen stamnummer beschikbaar** in de PSD-export (bevestigd tegen een echt voorbeeldbestand).
  Als een club ooit een extern lidnummer aanlevert, kan dat als extra optioneel matchveld naast
  (niet in plaats van) de naam+geboortedatum-sleutel.
- Elke fase: typecheck, productiebuild (niet tijdens een actieve dev-server) en Supabase
  SQL/RLS-tests lokaal vóór push, zoals in `club-team-roster-plan.md` afgesproken.
