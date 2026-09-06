# Introbeeld bij gedeelde clips

In het deelvenster kan een bevoegde gebruiker een wedstrijdkaart, sponsorkaart of eigen afbeelding kiezen. De duur is instelbaar van 0,5 tot 60 seconden. De score is optioneel: leeg betekent de opgeslagen wedstrijdstand, of vul zelf een stand in. De bestaande Belgische clublogo's worden gebruikt. Afbeeldingen: PNG/JPEG/WebP, maximaal 5 MB.

Het introbeeld speelt na een bewuste klik vóór de clip op de openbare deellink (ook via de korte tv-link). Downloads en originele video-/tagtijden veranderen niet. Bij geblokkeerd automatisch afspelen kan de kijker de gewone afspeelknop gebruiken. Bij een opslagstoring blijft de clip beschikbaar zonder intro.

Instellingen worden duurzaam in de bestaande R2-opslag bewaard onder `clip-intros/clip/{clipId}.json`, `clip-intros/match/{matchId}.json` en `clip-intros/team/{clubTeamId}.json`. Voorrang: clip, wedstrijd, ploeg, uit. Deze JSON-bestanden bevatten alleen publieke presentatiegegevens. Afbeeldingen krijgen unieke sleutels onder `clip-intros/assets/{clipId}/`. Serverreads gebruiken de S3-API, zodat gewijzigde instellingen niet afhankelijk zijn van de publieke CDN-cache. Geen databasemigratie of extra dienst vereist.

De bestaande rechten voor het delen van clips gelden voor bewerken en uploaden. Ploeg- en wedstrijdstandaarden vereisen daarnaast `sponsors.manage` en toegang tot de ploeg. De ploegstandaard bewaart alleen aan/uit en duur voor een gewone wedstrijdkaart: wedstrijdsponsors worden nooit automatisch overgedragen naar andere wedstrijden. De wedstrijdoptie bewaart de volledige kaart voor clips zonder eigen instelling. Alle links naar dezelfde clip gebruiken dezelfde clipinstelling.

Voor KM Torhout zijn alleen de gecontroleerde KMT A/B-ploegrecords ingeschakeld. Andere ploegen, inclusief jeugd, blijven standaard uit en kunnen de functie zelf activeren. De operationele initialisatie staat in `scripts/configure-kmt-clip-intros.mjs` en is veilig opnieuw uit te voeren: bestaande instellingen worden behouden.

Validatie vanuit `website`:

```powershell
npx.cmd tsc tests/clip-intro.test.ts src/lib/clip-intro.ts --outDir ../.codex-clip-intro-checks --module commonjs --target es2022 --esModuleInterop --skipLibCheck
node --test ../.codex-clip-intro-checks/tests/clip-intro.test.js
npm.cmd run typecheck
npm.cmd run build
```
