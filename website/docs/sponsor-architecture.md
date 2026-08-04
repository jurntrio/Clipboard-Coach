# Centrale sponsorarchitectuur

## Uitgangspunt

CBCS beheert sponsoridentiteit, zichtbaarheid en media. Sponsorinkomsten, bedragen, facturen, betalingen en financiële contractgegevens vallen uitdrukkelijk buiten het model.

## Voormalige Teamsponsor

De oude implementatie bewaarde één algemene banner op `clubs.general_sponsor_url` en één optionele afbeelding op `club_teams.sponsor_url`. Een wedstrijd kopieerde de keuze `club`, `team` of `none` naar `matches.sponsor_source`. Dit was geen centrale sponsoradministratie en kon een samengestelde testbanner voorstellen.

De oude velden blijven voorlopig compatibel. Hun URL's worden geïnventariseerd in `sponsor_legacy_sources`, maar nooit automatisch als officiële bedrijven aangemaakt. Een teambron kan later bewust aan een centrale sponsor worden gekoppeld.

## Nieuw model

- `sponsors`: één record per bedrijf en club, met publieke presentatiedata.
- `sponsor_private_details`: afzonderlijk afgeschermde contactgegevens en operationele notities.
- `sponsor_assets`: herbruikbare logo-, beeld- en video-assets.
- `sponsor_assignments`: seizoen-/periodegebonden commerciële toewijzing en niveau, zonder financiële velden.
- `sponsor_scopes`: configureerbare clubconcepten zoals Clubbreed, Jeugd of Eerste ploeg.
- `sponsor_scope_teams`: teams binnen een bereik, vastgelegd per seizoen.
- `sponsor_assignment_scopes`: meerdere bereiken per sponsortoewijzing.
- `sponsor_team_relations`: specifieke Teamsponsor of Teamaccent Extra/Prominent.
- `sponsor_match_configurations`: commerciële configuratie die naar één bestaande thuiswedstrijd verwijst.
- `sponsor_match_partners`: optionele wedstrijdsponsors en matchbalschenkers.

## Seizoenen

Een sponsor blijft over seizoenen bestaan. Toewijzingen, bereik-teamleden en teamrelaties verwijzen naar de bestaande `club_seasons`. Een gearchiveerd seizoen wordt via de API niet gewijzigd. Teamleden van een bereik worden niet dynamisch afgeleid, zodat een nieuw team nooit een oud seizoen verandert.

## Thuiswedstrijden en sponsorcontext

Games blijft de bron voor datum, aanvang, teams, tegenstander en thuis/uit. De sponsorlaag kopieert deze gegevens niet. Een databasetrigger weigert commerciële configuraties voor uitwedstrijden.

`sponsor_context_for_match` combineert clubbrede sponsors, bereik-sponsors, specifieke Teamsponsors, Teamaccenten, wedstrijdsponsors en matchbalschenkers. De functie groepeert dezelfde sponsor tot één record, bewaart alle redenen en gebruikt de hoogste toepasselijke prioriteit. Een uitwedstrijd geeft een lege sponsorlijst terug.

## Rollen en rechten

De formele rollen `commercial_manager` en `sponsor_viewer` zijn aan Clubrollen toegevoegd. Rechten zijn opgesplitst voor sponsors, assets, interne gegevens, bereiken, toewijzingen, teamrelaties en wedstrijdsponsoring. API-routes controleren deze rechten server-side; alleen zichtbaarheid in de frontend is nooit voldoende.

## Migraties

- `0124_sponsor_permissions.sql`
- `0125_central_sponsors.sql`
- `0126_sponsor_scopes.sql`
- `0127_team_sponsors_and_accents.sql`
- `0128_match_sponsoring_and_context.sql`

## Verificatie

- Bestaande Node-tests: 7 geslaagd.
- TypeScript-typecheck: geslaagd.
- Next.js-productiebuild: geslaagd, met reeds bestaande lintwaarschuwingen.
- `sponsor_architecture.test.sql`: 16 pgTAP-controles toegevoegd voor uniciteit, seizoensisolatie, clubbreed gedrag, meerdere bereiken, Teamaccent, thuis/uit en contextontdubbeling.
- De lokale Supabase CLI/testdatabase was in deze werkruimte niet beschikbaar; de pgTAP-suite moet bij het toepassen van de migraties in de databasepipeline worden uitgevoerd.

## Nog buiten scope

Volledige ClubTV/SVC-playlists, campagnes, planning, sponsorstatistieken, advertentieweergaven en financiële sponsoradministratie zijn niet gebouwd. De context-API en prioriteiten vormen alleen de herbruikbare basis voor die latere onderdelen.
