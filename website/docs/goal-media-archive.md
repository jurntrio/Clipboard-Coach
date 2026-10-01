# Doelpunten en bewaarde beelden

Een doelpunttag wordt gekoppeld aan de stabiele doelpunt-ID in `match_dossiers.goal_events`.
De stand is altijd thuis–uit. Eerst het verslag invullen of eerst de video taggen
gebruikt dezelfde koppeling; meerdere tags/camerahoeken kunnen bij één doelpunt horen.

In Video Viewer vraagt Goal om een bestaand doelpunt of de stand na een nieuw doelpunt.
Bij **Doelpuntbeelden** controleert de trainer begin/einde en kiest
**Tijden bevestigen en clip bewaren**. Een tag of koppeling alleen bewaart geen beelden.
Lokale fragmenten worden in de browser gemaakt en naar R2 geüpload; 360/remote
fragmenten worden door de bestaande worker gekopieerd en verwerkt naar R2.
Alleen een voltooide clip met opgeslagen fragmenten krijgt **Clip bewaard**.
Het verslag opent die zelfstandige clip via **Bekijk doelpunt**, ook rechtstreeks
via de stand in **Scoreverloop**.

Dezelfde bevestiging is beschikbaar bij **Doelpuntbeelden** in het wedstrijdverslag.
Bewaar eerst de ingevulde doelpunten; kies daarna de tag, controleer begin/einde
en bevestig de clip. Bij een lokale opname kan het bronbestand daar opnieuw
worden gekozen. De bevestigde cliptijden kunnen afwijken van de oorspronkelijke
tagtijden en worden afzonderlijk opgeslagen. Nieuwe doelpunten bieden een keuze
voor doelpuntenmaker en assistgever; bestaande doelpunten bewerk je in het verslag.
Het dashboard en de ploegwedstrijdlijst tonen de videolink bij afgelopen wedstrijden.

Bevestigde tijden worden vastgelegd op het clipsegment. Een latere tagcorrectie
verandert die snapshot niet: opnieuw bevestigen maakt een nieuwe bewaarde clip.
Een herhaalde bevestiging van dezelfde tijden hergebruikt de clip; mislukte clips
blijven herkenbaar en kunnen opnieuw worden aangemaakt. De oorspronkelijke
tag verwijderen laat de doelpuntkoppeling en bewaarde clip bestaan.

Clips met `archived_goal = true` zijn uitgezonderd van de automatische opruiming
na 365 dagen. Bewuste verwijdering van een clip, wedstrijd of account blijft gelden.
Een bronopname moet beschikbaar zijn totdat het fragment volledig is opgeslagen.

## Uitrollen

1. Pas Supabase-migratie `0208_goal_media_archive.sql` toe.
2. Rol de worker uit: snapshot-tijden en uitzondering op clipretentie vereisen deze versie.
3. Rol de website uit: nieuwe API, opslagbevestiging en video-icoon in de ploegwedstrijdlijst.

De server controleert club-, ploeg- en taglidmaatschap. Databasefuncties voor
koppelen en verslag bewaren zijn alleen uitvoerbaar door de service-role en
vergrendelen dezelfde wedstrijd om gelijktijdig bewaren te serialiseren.
Een oud verslag dat een inmiddels gekoppeld doelpunt zou verwijderen wordt
geweigerd met een melding om te vernieuwen.

## Een verkeerde koppeling corrigeren

Kies **Bewerken** naast het betreffende fragment, selecteer het juiste doelpunt
of vul een nieuwe stand in, en kies **Koppeling opslaan**. Het bewaarde fragment
blijft bestaan en verhuist mee naar het juiste doelpunt. De andere koppelingen
en het oorspronkelijke doelpunt blijven behouden. Ook de cliptijden kunnen
opnieuw bevestigd worden. Migratie `0209_edit_goal_media.sql` bewaakt dat een
gelijktijdig gewijzigde koppeling niet wordt overschreven.
