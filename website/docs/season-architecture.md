# Seizoensarchitectuur

## Vertrekpunt

CBCS had sinds migratie 0030 al `club_seasons`, een blijvende `club_players`-identiteit en
`player_team_memberships`. De operationele UI bleef echter vooral `players.team_id`,
`club_teams` en permanente `club_trainer_teams` gebruiken. Extra groepen (0113) waren
clubgebonden, maar niet seizoengebonden. Trainingen, wedstrijden en groepsevaluaties hadden
evenmin een expliciete historische seizoenssleutel. Intradesk is bewust clubbreed en heeft al
aparte versies; media blijft via wedstrijd/team verwijzen en wordt niet gekopieerd.

## Doelmodel

- `club_seasons` heeft PREPARATION, ACTIVE en ARCHIVED, vrije naam/datums en maximaal één ACTIVE seizoen per club.
- `club_players` blijft de persoon. `player_team_memberships` is de seizoensgebonden sportieve relatie met geldigheidsdatums en één primair team.
- Teams, teamstaf en Extra groepen dragen `season_id`. Structuren worden vooraf gekopieerd naar nieuwe records; groepsleden en staf worden niet stilzwijgend meegenomen.
- De voorbereidings-UI laat staf per toekomstig team en spelers/staf per toekomstige Extra
  groep opnieuw bevestigen. De bewerkingen zijn transactionele RPC's en valideren club- en
  seizoensgrenzen in de database.
- Trainingen, wedstrijden en evaluaties krijgen bij creatie/legacy-backfill hun seizoen. Archiefschermen kunnen daardoor read-only filteren zonder namen of relaties te herschrijven.
- Het read-only archief toont per historisch team de toenmalige samenstelling en staf,
  trainingssessies en Intradesk-referenties, de aanwezigheidsmatrix met membershipbegrenzing,
  wedstrijden en wedstrijdverslagen, Extra groepen, evaluaties en het aantal bewaarde
  mediareferenties. Bestaande team-, training-, aanwezigheids- en dossiermutaties weigeren een
  ARCHIVED seizoen server-side.
- `season_player_decisions` bewaart TEAM, UNDECIDED of LEAVING. LEAVING verwijdert geen identiteit of historie.
- Aanbevolen doorstroom is configureerbaar via `season_team_pathways`.
- Het doorschuifscherm start op "Nog te verdelen", ondersteunt bulkacties en bewaart TEAM,
  UNDECIDED of LEAVING. Een wijziging verplaatst alleen het membership voor het doelseizoen;
  `club_players.id` blijft gelijk. Per speler/seizoen voorkomt een transactioneel advisory lock
  concurrerende dubbele primaire toewijzingen.

## Activatie en herstel

Voorbereiden maakt alle nieuwe records. `activate_club_season` neemt een transactioneel
club-specifiek advisory lock, draait preflight, archiveert het oude seizoen en activeert het
nieuwe. Een herhaling retourneert idempotent succes. ERROR blokkeert; WARNING blijft een
bewuste adminbeslissing. Runs worden gelogd. PostgreSQL/Supabase point-in-time recovery of een
provider snapshot blijft de echte backupstrategie; CBCS bouwt geen schijnbackup. Door de ene
transactie kan een mislukking geen half actieve toestand publiceren.

Slots zijn UTC-instanties met capaciteit; presentatie gebruikt `clubs.timezone`. Reservaties
zijn uniek per club/doelseizoen zolang ze actief zijn. Een worker kan verlopen SCHEDULED-rijen
claimen met `FOR UPDATE SKIP LOCKED`. De interne workerroute vereist
`SEASON_TRANSITION_CRON_SECRET`; alleen de service role kan de worker-RPC uitvoeren. Reserveren
vergrendelt uitsluitend het gekozen slot en controleert de capaciteit opnieuw in dezelfde
transactie. CBCS gebruikt de bestaande mailbox voor de planning- en succesmelding.

## Compatibiliteit en vervolgwerk

Migratie 0117 koppelt bestaande actuele gegevens veilig aan de actieve/baseline 2026-2027 en
voert de bestaande idempotente spelerbackfill uit. Oude operationele routes blijven werken.
Nieuwe writes moeten vervolgens altijd `season_id` uit de gekozen team/groep afleiden. Voor
volledige archief-UX zijn nog detailtabs nodig voor historische wedstrijden, dossiers,
statistieken en mediaretentie. Trainingsstatistieken moeten bij de datumfilter ook
`joined_at/left_at` toepassen; de membershipvelden zijn daarvoor aanwezig. Intradesk-items
worden niet gedupliceerd; uitgevoerde sessies houden hun bestaande trainingsreferentie.
