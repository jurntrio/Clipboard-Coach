# Beelden in het opgeslagen clipbestand

## Gebruikerspad

1. Clubbeheer → Teams & spelers → Bewerken bij een ploeg → **Introbeelden bij clips toestaan**. Wijzigingen worden onmiddellijk bewaard. Alleen beheerders met `teams.manage`, ploegtoegang en een bewerkbaar seizoen kunnen deze toestemming wijzigen.
2. Bij **Clip maken** in de videoviewer verschijnt voor een toegelaten ploeg **Beelden bij deze clip**. Een beeld is nooit verplicht; alles staat bij een nieuwe clip uit.
3. Optioneel één openingsbeeld: wedstrijdkaart, wedstrijdkaart met sponsor (vrije benaming, bijvoorbeeld Wedstrijdsponsor of Balsponsor), of eigen upload. Score optioneel; een eigen stand kan worden ingevuld. Duur 0,5–60 seconden.
4. Optioneel een eigen afbeelding vóór iedere geselecteerde tag, met eigen duur. Bij meerdere camera’s verschijnt het tagbeeld eenmaal vóór de eerste camera van die tag. De gekozen tagvolgorde wordt gevolgd.
5. De worker verwerkt de beelden in de MP4-segmenten. Preview, download en deellink gebruiken deze zelfde bestanden. Delen maakt geen nieuwe video en heeft geen aparte beeldinstelling meer.

Toestemming volgt de **ploeg van de bronwedstrijd**, niet de gekozen ontvangers. KMT A/B zijn initieel toegelaten. Jeugd, inclusief IP U13 Groen, blijft uit tenzij een beheerder toestemming geeft. Het uitschakelen van een ploeg verandert reeds gemaakte videobestanden niet. Bestaande clips worden niet automatisch opnieuw opgebouwd; oude virtuele intro-instellingen bij deellinks worden niet meer afgespeeld.

## Opslag en verwerking

- `clip-intros/permissions/{clubTeamId}.json`: `{allowed: boolean}`. Ontbrekend betekent uit, met alleen als overgang de eerder expliciet opgeslagen ploegstandaard. `scripts/configure-kmt-clip-intros.mjs` initialiseert KMT A/B zonder bestaande toestemmingen te overschrijven.
- `clip-intros/creation/{userId}/{videoId}/{uuid}.png`: gevalideerde, genormaliseerde uploads (PNG/JPEG/WebP, maximaal 5 MB, maximaal 40 miljoen bronpixels). Deze beelden zijn herbruikbaar bij clips van die video.
- `clip-intros/render-assets/{clipId}/opening.png`: de vastgelegde wedstrijd-/sponsorkaart, gemaakt met de wedstrijdgegevens en clublogo’s bij het aanmaken.
- `clip-intros/renders/{clipId}.json`: versie 1, per werkelijk clipsegment maximaal twee voorafgaande afbeeldingen. Server controleert eigenaar, ploegtoestemming, geselecteerde tags, uploadscope en duur. De worker accepteert alleen de genoemde afbeeldingssleutels, nooit willekeurige paden/URLs.
- De manifesten en gegenereerde openingskaarten worden met de clip verwijderd. Originele video’s en tagtijden veranderen niet.

De remote clipworker ondersteunt zowel lokale uploads als online bronvideo’s. Bij clips met beelden worden alle outputsegmenten naar dezelfde 1280×720 H.264/AAC-instellingen genormaliseerd zodat samengestelde downloads compatibele tracks hebben. Afbeeldingen worden met behoud van verhouding geplaatst, met zwarte randen waar nodig, en hebben stilte. De matchaudio blijft behouden. Reeds voltooide segmenten worden bij een herstart hergebruikt; beelden worden niet dubbel ingevoegd.

Geen databasemigratie of nieuwe dependency vereist. Publiceer **website én worker**. De website controleert voor beeldclips de worker-capability `clipImageIntros: 1` via `/health` en weigert verwerking als de nieuwe worker nog ontbreekt, zodat gekozen beelden nooit stilzwijgend wegvallen.

De bestaande productiehosting gebruikt twee branches: Netlify volgt `main` voor de website; Railway volgt `master` voor de worker. Publiceer workerwijzigingen ook op die workerbranch en controleer de capability vóór de websitepublicatie. Neem daarbij geen niet-gerelateerde wijzigingen uit de andere branch mee.

## Verificatie

Vanuit `website`:

```powershell
npx.cmd tsc tests/clip-images.test.ts tests/clip-intro.test.ts src/lib/clip-images.ts src/lib/clip-intro.ts --outDir ../.codex-clip-images-checks --module commonjs --target es2022 --esModuleInterop --skipLibCheck
node --test ../.codex-clip-images-checks/tests/clip-images.test.js ../.codex-clip-images-checks/tests/clip-intro.test.js
npm.cmd run typecheck
npm.cmd run build
```

Vanuit `worker`: `npm.cmd test` en `npm.cmd run build`. De FFmpeg-test controleert werkelijk gecodeerde frames, duur, audio, verschillende beeldverhoudingen en compatibele segmenten met en zonder voorafgaand beeld.
