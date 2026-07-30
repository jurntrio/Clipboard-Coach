# Club people backfill — lokale dry-run van 2026-07-30

## Veiligheidscontext

- Bron is read-only bevraagd: `cglfyesmrzwjizfbsvzi.supabase.co`.
- Alleen clubs, clubteams, operationele teams, seizoenen, `club_players`,
  `player_team_memberships` en de gekoppelde operationele `players` zijn gelezen.
- De snapshot is binnen één lokale PostgreSQL-transactie geladen.
- Na analyse is de volledige transactie teruggerold.
- Controle na rollback: lokale `club_players`-telling is opnieuw `0`.
- Productie is niet gewijzigd en migraties zijn niet naar productie gedeployed.

## Samenvatting

| Meting | Resultaat |
|---|---:|
| Preview-hash | `a2dab735cd3ee0bd4ae055a710503fc4` |
| Clubs | 1 |
| Clubteams / operationele teams | 3 / 3 |
| Clubspelers | 28 |
| Reeds gekoppeld | 0 |
| Nieuwe `people` voorgesteld | 28 |
| Bestaande `people` voorgesteld | 0 |
| Zekere nieuwe identiteiten | 28 |
| Onzekere gevallen | 0 |
| Mogelijke duplicaten | 0 |
| Ontbrekende identificerende gegevens | 0 |
| Meerdere kandidaten | 0 |
| Memberships vóór backfill | 54 |
| Seizoenen in memberships / `club_seasons` | 1 / 1 |
| Gekoppelde operationele spelers | 54 |
| Verweesde membershipreferenties | 0 |
| Verweesde operationele spelerreferenties | 0 |

Er bestaan in de huidige productie nog geen `people`/`club_people`-rijen. Daarom is voor iedere
bestaande `club_player` precies één nieuwe persoon de veilige mutatie. Er vindt geen match of merge
met een bestaande persoon plaats.

## Dylan Bauwens

- Bestaande `club_players.id`: `a65df2b0-c02d-4d74-b9a1-19088be3505a`.
- Geboortedatum: `2001-02-16`.
- Bestaande membership: `29eac58b-8fc3-46ce-8eb6-19f4650971e5`.
- Team: KMT B.
- Membership: actief en primair.
- Seizoen: `32a7caa4-8da9-4836-ace3-69a1c64a19d7`.
- Voorstel: één nieuwe `people`-rij en één nieuwe `club_people`-rij; daarna alleen
  `club_players.club_person_id` invullen.
- Geen tweede `club_player`, geen nieuw membership en geen wijziging aan zijn KMT B-membership.

## Voorgestelde nieuwe people

Voor iedere rij is de exacte mutatie gelijk:

1. `insert into people` met naam en geboortedatum uit de bestaande `club_players`-rij;
2. `insert into club_people` voor dezelfde club en de nieuwe persoon;
3. `update club_players set club_person_id = ... where id = ...`;
4. provenance en auditlog schrijven.

| Bestaande `club_players.id` | Persoon | Geboortedatum |
|---|---|---|
| `a65df2b0-c02d-4d74-b9a1-19088be3505a` | Dylan Bauwens | 2001-02-16 |
| `5078cc19-5305-47f0-9edf-f4f0571a4800` | Mikai Bruneel | 2014-04-08 |
| `cf009d69-4d2c-43bb-987b-01e73749bd58` | Thibault Callens | 2014-01-24 |
| `5f1ddcc4-d166-4981-a23b-9111782815ad` | Ymen Constant | 2014-05-17 |
| `6a48aea2-61ca-4497-9d62-2531999cc534` | Nand Corveleyn | 2014-12-26 |
| `74c2ee57-063c-4804-a379-c21b7a0ed6b9` | Xam Debergh | 2014-04-10 |
| `06f13b5b-884c-48c3-8903-95ba7cd59e64` | Lukas De Gryse | 2014-05-06 |
| `87a26b93-0512-4f96-83fd-79fe87ed8923` | Milan Denolf | 2004-09-12 |
| `000b6b92-30ff-4b69-a973-0501008710b9` | Miel Denoo | 2014-07-11 |
| `01afd9a1-3a6c-46d8-b9f8-68eb084dd152` | Mateo Depuydt | 2014-12-23 |
| `9fdb0ac0-7414-401e-b945-6e8d207e10ee` | Jerome Deswaef | 2014-09-26 |
| `ab929701-fee2-4be8-a01b-86b6564ecdf4` | Maurice Heytens | 2014-01-21 |
| `1504cdfa-de6d-4eb9-91a2-15e72a2d6b44` | Scott Lapere | 2014-11-18 |
| `1b5934d0-17e5-4fd1-abce-3850e3b1a95d` | Arven Lingier | 2014-10-17 |
| `f5a7e020-2773-43d2-9e50-5695819d1697` | Arthur Maertens | 2014-04-17 |
| `7a828f1a-2790-4526-918a-fa043668a583` | Fons Manhout | 2014-05-15 |
| `9bc5a37a-024a-4b0f-8119-ed7875648a96` | Obi Masureel | 2014-08-26 |
| `81a96d5a-94f9-4a9f-89b4-ee212de2c059` | Jarne Rosseel | 2014-03-21 |
| `1b7c0792-1191-41df-81e9-cc18c377979c` | Jesse Sandwidi | 2014-07-06 |
| `4399b046-96dd-468c-83e5-8e51a6e5d913` | Iben Taillieu | 2014-01-31 |
| `45152d43-5190-4cee-80db-4ac6ba1b7f79` | Jayden Tommelein | 2014-06-02 |
| `2cf0bc63-d1ef-482b-a5a1-dfd9d1ed2120` | Jules Vandekinderen | 2014-04-15 |
| `3abf41a5-4139-49e3-849c-b3a18014a142` | Arthur Van der Linde | 2014-08-16 |
| `29b6679d-3af6-419a-9adf-e5657b1b7c6e` | Lucas Van Dorpe | 2014-02-05 |
| `589159fc-36a2-438e-a371-2fc46d27868f` | Vic Vanhoorenweder | 2014-03-27 |
| `44440390-3b3e-4fa8-945a-9383bbefb2d5` | Ayhden Vanthourenhout | 2014-10-24 |
| `e8fc1cda-2e0a-4140-8596-9d8acece892f` | Henri Verkest | 2014-07-09 |
| `5391d651-c1d3-471a-8b14-1beab6560e5e` | Matteo Vermeersch | 2014-06-24 |

## Onzekere gevallen en voorgestelde bestaande koppelingen

Geen. Er zijn geen bestaande `people`-rijen in de snapshot, geen ontbrekende geboortedatums,
geen meervoudige kandidaten en geen mogelijke duplicaten.

## Exact effect van een goedgekeurde uitvoering

- 28 nieuwe `people`;
- 28 nieuwe `club_people`;
- 28 updates van uitsluitend `club_players.club_person_id`;
- 28 provenance-acties en bijbehorende auditregels;
- 0 nieuwe of verwijderde `club_players`;
- 0 gewijzigde of verwijderde `player_team_memberships`;
- 0 gewijzigde of verwijderde `club_seasons`;
- 0 gewijzigde operationele `players`;
- 0 automatische merges;
- `club_players.club_person_id` blijft nullable.

## Rollback

`rollback_club_people_backfill(run_id)`:

1. lockt de run;
2. blokkeert als later een actief account of actieve functie aan een nieuw persoon is gekoppeld;
3. zet uitsluitend de 28 door die run ingevulde `club_players.club_person_id` terug op `null`;
4. archiveert de door de run gemaakte `people`;
5. beëindigt de door de run gemaakte `club_people`;
6. bewaart provenance en schrijft een auditregel;
7. verwijdert geen speler, membership, seizoen of operationele speler.

## Verificatie

- Alle migraties vanaf een lege lokale database: geslaagd.
- Nieuwe people/account/role- en backfillsuites: 60/60 tests geslaagd.
- Dry-run tegen transactionele lokale kopie van de relevante productiegegevens: geslaagd.
- Snapshot na analyse volledig teruggerold.
- Geen productiebackfill en geen deploy uitgevoerd.
