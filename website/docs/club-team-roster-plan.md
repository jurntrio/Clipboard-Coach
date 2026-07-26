# Clubteams en vooraf beheerde spelerslijsten

## Doel

Een clubadmin moet alle teams, trainers en spelerslijsten vooraf kunnen klaarzetten. Een trainer ziet na registratie of toewijzing automatisch de juiste teams in **Teams** en kan een spelerslijst alleen aanpassen wanneer de clubadmin dat toestaat.

Dit plan vertrekt van de club- en teamregistratie die via `origin/master` is toegevoegd.

## Gewenste gebruikerservaring

### Clubadmin

- Toon in het teamoverzicht geen leeftijdscategorie en geen niveau of reeks.
- Vervang de zichtbare status **Active** door een actie **Edit**.
- Toon per team de toegewezen trainers, assistenten en teammanagers.
- Laat een clubadmin een teamnaam, gebruikerstoewijzingen en spelerslijst beheren.
- Hergebruik voor spelersimport hetzelfde ProSoccerData Excel-formaat en dezelfde lokale bestandsverwerking als in de bestaande teamwizard.
- Laat een clubadmin spelers manueel toevoegen of corrigeren vóór een trainer geregistreerd is.
- Voeg per team de instelling **Trainer mag spelerslijst aanpassen** toe.
- Een wijziging van die instelling geldt voor alle toegewezen trainers; de clubadmin behoudt altijd beheerrechten.

### Trainer of andere toegewezen gebruiker

- Toon in **Teams** zowel:
  - teams die de gebruiker zelf tijdens registratie koos;
  - teams die een clubadmin aan de gebruiker toewees.
- Toon één team maar één keer wanneer beide routes naar hetzelfde clubteam verwijzen.
- Toon de volledige, door de club voorbereide spelerslijst.
- Sta toevoegen, wijzigen, importeren en verwijderen van spelers alleen toe wanneer **Trainer mag spelerslijst aanpassen** aanstaat.
- Houd bekijken en gebruiken van spelers voor tagging mogelijk wanneer bewerken uitstaat.
- Beperk teamnaam wijzigen, team verwijderen en gebruikerstoewijzingen tot de clubadmin.

## Datamodel

Voeg in een nieuwe Supabase-migratie na `0022` toe:

- `club_teams.trainers_can_edit_roster boolean not null default true`.
- `teams.club_team_id uuid references club_teams(id)`.
- Een unieke index op `teams.club_team_id` zodat één clubteam exact één operationele spelerslijst heeft.
- Een server-side functie of API-transactie die bij het aanmaken van een clubteam ook de operationele `teams`-rij aanmaakt.

De bestaande `players.team_id`-relatie blijft behouden. Daardoor blijven video-, tag-, clip- en wedstrijdflows werken zonder een tweede spelersmodel te introduceren.

Omdat `teams.coach_id` momenteel verplicht is, moet de migratie het operationele team club-eigendom geven in plaats van persoonlijk eigendom:

- maak `teams.coach_id` nullable voor clubteams;
- persoonlijke teams behouden hun bestaande `coach_id`;
- autorisatie voor clubteams loopt via `club_memberships` en `club_trainer_teams`;
- verwijder een clubteam niet automatisch wanneer een traineraccount verdwijnt.

Bewaar `age_category` en `level_or_competition` voorlopig in de database voor compatibiliteit met bestaande registraties, maar verwijder ze uit de clubadmininterface en uit nieuwe clubteamformulieren. Een latere datamigratie kan bepalen of de kolommen volledig weg mogen.

## Autorisatie

Alle mutaties voor clubteams verlopen via gecontroleerde API-routes; gebruik hiervoor geen onbeperkte browsermutaties met de service role.

- Clubadmin:
  - mag clubteams, toewijzingen en spelers beheren;
  - mag `trainers_can_edit_roster` wijzigen.
- Toegewezen trainer, assistent of teammanager:
  - mag team en spelers bekijken;
  - mag spelers alleen muteren als de instelling aanstaat;
  - mag nooit zelf de instelling of gebruikerstoewijzingen wijzigen.
- Niet-toegewezen clubleden:
  - krijgen geen toegang tot de spelerslijst via de Teams-pagina.
- Platformadmin:
  - behoudt de bestaande beheeroverride.

Voeg RLS-tests toe voor bekijken, toevoegen, wijzigen, verwijderen en importeren met de instelling zowel aan als uit.

## Implementatiefasen

### 1. Schema en serverlogica

- Voeg de koppeling en wijzigingsinstelling toe.
- Maak bestaande clubteams veilig aan operationele teams vast.
- Werk registratie en clubadmintoewijzing bij zodat beide dezelfde teamkoppeling gebruiken.
- Voeg API-endpoints toe voor teamdetails, spelersmutaties en bulkimport.

### 2. Clubadmininterface

- Vereenvoudig de teamkaart tot teamnaam, toegewezen coaches en **Edit**.
- Maak een editor voor naam, toegewezen gebruikers, spelerslijst en wijzigingsrecht.
- Deel de bestaande PSD-parser met de normale teamwizard in één herbruikbare module.
- Toon een importpreview en bevestiging voordat records worden opgeslagen.

### 3. Teams voor de gebruiker

- Laad persoonlijke en toegewezen clubteams in één query/API-response.
- Toon per team of de lijst door de club wordt beheerd.
- Verberg of deactiveer alle spelersmutaties wanneer de gebruiker geen toestemming heeft.
- Voorkom dat een toegewezen gebruiker een clubteam verwijdert of hernoemt.

### 4. Migratie en kwaliteitscontrole

- Koppel bestaande persoonlijke teams waar mogelijk op club en genormaliseerde teamnaam.
- Rapporteer twijfelgevallen in plaats van automatisch fout samen te voegen.
- Test registratie vóór en na clubadmintoewijzing.
- Test dat een vooraf geïmporteerde spelerslijst meteen zichtbaar wordt na registratie.
- Draai typecheck, productiebuild en Supabase SQL/RLS-tests lokaal vóór een push.
- Push pas na lokale controle om onnodige Netlify-buildcredits te vermijden.

## Acceptatiecriteria

- Een clubadmin kan een team met spelers aanmaken zonder dat de trainer al een account heeft.
- De PSD-import gebruikt hetzelfde formaat en dezelfde validatie als de bestaande teamwizard.
- Toegewezen coaches staan zichtbaar op de teamkaart.
- **Active**, leeftijdscategorie en niveau/reeks staan niet meer in het clubadmin-teamoverzicht.
- Een geregistreerde of later toegewezen gebruiker ziet het team automatisch onder **Teams**.
- Dezelfde clubteamtoewijzing veroorzaakt nooit dubbele teams.
- Bij uitgeschakeld wijzigingsrecht kan de trainer spelers bekijken en gebruiken, maar niet toevoegen, aanpassen, importeren of verwijderen.
- Bij ingeschakeld wijzigingsrecht kan de trainer de spelerslijst wel beheren.
- Een verwijderd traineraccount verwijdert het clubteam en zijn spelers niet.
