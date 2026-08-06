# Clipboard Coach Studio — productbacklog

Dit document is de centrale verzamelplaats voor productideeën en werk dat bewust nog niet in de actieve bouwscope zit.

## Werkwijze

- **Nu**: eerstvolgende concrete verbeteringen.
- **Later**: waardevol, maar pas oppakken na de huidige desktop- en stabiliteitsronde.
- **Onderzoek**: idee waarvoor eerst keuzes, gebruikersfeedback of technische analyse nodig zijn.
- Bij uitvoering krijgt een item een eigen plan of issue met duidelijke acceptatiecriteria.
- Afgewerkte items worden uit deze backlog verwijderd en vastgelegd in de releasehistoriek.

## Nu

### Migratie naar Sport Visual Systems

**Doel:** alle product-, bedrijfs- en communicatie-uitingen gecontroleerd omzetten naar de definitieve merkstructuur van Sport Visual Systems.

**Vastgelegd:** `sportvisualsystems.com` is geregistreerd en wordt het nieuwe primaire domein en de nieuwe hoofdpagina.

Te behandelen:

- Beslissen of **Clipboard Coach Studio** als productnaam onder **Sport Visual Systems** blijft bestaan of volledig wordt vervangen.
- Een inventaris maken van alle huidige namen, logo’s, iconen, kleuren en teksten in website, desktopapp, e-mails, documenten en gedeelde links.
- Navigatie, paginatitels, metadata, login- en registratiepagina’s, foutmeldingen en lege toestanden aanpassen.
- Domeinen, afzendernamen, supportgegevens, juridische documenten en privacyteksten controleren.
- Publieke deelpagina’s, Club TV, uitnodigingspagina’s en andere pagina’s buiten het dashboard meenemen.
- Desktopapp, installatienaam, snelkoppelingen en eventuele update-informatie meenemen.
- Bestandsnamen en interne technische namen alleen wijzigen wanneer dat veilig en zinvol is; een visuele rebranding mag geen bestaande data of links breken.
- Een overgangsplan voorzien voor bestaande gebruikers, links en herkenbaarheid.
- Na de omzetting controleren dat nergens oude of gemengde branding zichtbaar blijft.

Domeinmigratie:

- `sportvisualsystems.com` aan de productiehosting koppelen en als primair domein instellen.
- DNS en TLS-certificaat volledig laten activeren voordat verkeer wordt omgezet.
- Het huidige `clipboardcoachstudio.com` behouden en met permanente redirects naar de juiste nieuwe pagina’s sturen.
- Bestaande gedeelde links, uitnodigingslinks en e-maillinks tijdens de overgang bruikbaar houden.
- Applicatiebasis-URL’s en omgevingsvariabelen aanpassen.
- Supabase-login-, callback- en toegestane redirect-URL’s uitbreiden en daarna omschakelen.
- R2/object-storage CORS configureren voor het nieuwe productiedomein en het oude domein tijdelijk behouden.
- Netlify, geplande functies, webhooks en externe diensten controleren op vast ingestelde domeinnamen.
- Canonical URL’s, metadata, sitemap, robots-instellingen en social-previewlinks aanpassen.
- Afzenderdomein voor e-mail configureren en SPF, DKIM en DMARC valideren.
- Eerst een volledige rooktest uitvoeren op het nieuwe domein: login, registratie, uploads, video, gedeelde links, uitnodigingen en e-mails.
- Pas na succesvolle controle het nieuwe domein publiek communiceren en het oude domein doorsturen.

**Open merkbeslissing:** “Sport Visual Systems” als bedrijfsmerk met “Clipboard Coach Studio” als product, of één volledige productnaam. Het hoofddomein ligt al vast; deze productnaamkeuze moet vóór de brede tekst- en assetmigratie volgen.

**Status:** belangrijk; eerst merkbeslissing en volledige inventarisatie maken.

### Branding van systeem- en gebruikersmails

**Doel:** iedere e-mail naar geregistreerde gebruikers herkenbaar, professioneel en consistent laten aansluiten bij Sport Visual Systems en het gekozen productmerk.

Te behandelen:

- Alle e-mailstromen inventariseren: registratie, uitnodigingen, mailboxmeldingen, wachtwoordherstel, accountkoppelingen, club- en teamuitnodigingen, goedkeuringen en andere systeemmeldingen.
- Eén herbruikbare responsive e-mailtemplate maken met logo, kleuren, typografie, afzender en footer.
- Duidelijke onderwerpregels, preheaders en actieknoppen gebruiken.
- Correcte links naar het juiste domein en de juiste actie opnemen.
- Een tekstalternatief voorzien voor clients die HTML beperkt ondersteunen.
- Controleren hoe mails eruitzien in Gmail, Outlook, Apple Mail en op gsm.
- Donkere modus en geblokkeerde afbeeldingen op een bruikbare manier opvangen.
- Juridische footer, privacyverwijzing, contactadres en eventuele uitschrijfmogelijkheid correct toepassen per type e-mail.
- Voorkomen dat gevoelige informatie in onderwerpregels of notificatievoorbeelden verschijnt.
- Afzenderdomein en afleverbaarheid controleren, inclusief SPF, DKIM en DMARC.
- Testmails en visuele snapshots voorzien om latere stijlbreuken te detecteren.

**Afhankelijkheid:** de definitieve merkstructuur en e-mailafzender moeten aansluiten bij de migratie naar Sport Visual Systems.

**Status:** belangrijk; samen met de merkbeslissing voorbereiden en daarna gefaseerd op alle e-mailstromen toepassen.

## Later

### Volledige mobiele en responsive herwerking

**Doel:** Clipboard Coach Studio comfortabel bruikbaar maken op een gsm, zonder de desktopwerking te verslechteren.

Te behandelen:

- Een compacte mobiele hoofdnavigatie, bij voorkeur met 4 à 5 kernfuncties onderaan.
- Minder gebruikte en rolgebonden modules in een duidelijk aanvullend menu.
- Compacte club- en ploegkeuze bovenaan.
- Tabellen omzetten naar mobiele kaarten of gecontroleerd horizontaal scrollbare weergaven.
- Grotere aanraakvlakken en voldoende afstand tussen acties.
- Dialogen en formulieren schermvullend of gestapeld tonen op kleine schermen.
- Trainingen en wedstrijden als compacte dag- of weekkaarten presenteren.
- Filters, tabs en formulierkolommen logisch onder elkaar plaatsen.
- Dashboard, Wedstrijden, Trainingen, Teams en Mailbox afzonderlijk nalopen.
- Video Viewer en tagging beoordelen voor zowel staande als liggende schermstand.
- Testen op gangbare smalle schermbreedtes en met echte touchbediening.

**Status:** geparkeerd voor een latere, afzonderlijke responsive fase.

### Veo-informatie en wedstrijdlinks

**Doel:** Veo-wedstrijden en relevante Veo-informatie op een duidelijke, betrouwbare manier aan Clipboard Coach-wedstrijden koppelen.

Te behandelen:

- Een Veo-link aan een bestaande wedstrijd kunnen toevoegen en aanpassen.
- Veo-wedstrijdinformatie duidelijk op de wedstrijdpagina tonen.
- Dubbele wedstrijden vermijden wanneer dezelfde wedstrijd via een kalender, import of Veo-link binnenkomt.
- Controleren welke metadata veilig en betrouwbaar uit een Veo-link kan worden afgeleid.
- De koppeling behouden wanneer een wedstrijd later wordt aangepast of opnieuw geïmporteerd.
- Duidelijke foutmeldingen voorzien voor ongeldige, afgeschermde of niet meer beschikbare Veo-links.
- Rekening houden met lokale video, een externe Veo-link en eventueel meerdere videobronnen voor dezelfde wedstrijd.

**Status:** later uitwerken samen met de vernieuwde wedstrijdverwerking.

### Wedstrijdpagina’s en wedstrijdverwerking herwerken

**Doel:** van de wedstrijdpagina één duidelijke workflow maken voor voorbereiding, live gebruik, verwerking en afsluiting.

Te behandelen:

- De wedstrijdpagina opdelen in logische fases: gepland, voorbereiding, bezig, verwerking en afgerond.
- Selectie, opstelling, wissels, speelminuten, score, gebeurtenissen, verslag, scouting, tags, clips en video overzichtelijk samenbrengen.
- Na de wedstrijd een expliciete verwerkingsstap aanbieden voordat statistieken definitief worden opgeslagen.
- Onvolledige of tegenstrijdige wedstrijdgegevens signaleren.
- Een afgeronde wedstrijd gecontroleerd opnieuw kunnen openen en corrigeren.
- Vastleggen welke gegevens automatisch uit tagging of video kunnen komen en welke altijd manueel bevestigd moeten worden.
- Zorgen dat wedstrijdgegevens bij het juiste actieve seizoen en team terechtkomen.
- De workflow geschikt maken voor zowel desktop als de latere mobiele herwerking.

**Status:** later; eerst functioneel en datatechnisch ontwerpen voordat de schermen worden aangepast.

### Wedstrijdgebeurtenissen koppelen aan spelersstatistieken

**Doel:** bevestigde wedstrijdgebeurtenissen automatisch en correct verwerken in individuele spelersstatistieken.

Te behandelen:

- Goals aan de juiste speler koppelen.
- Assists aan de juiste speler koppelen.
- Eigen doelpunten, strafschoppen en gebeurtenissen zonder bekende speler correct behandelen.
- Speelminuten berekenen op basis van basisopstelling, wissels en wedstrijdduur.
- Per speler statistieken tonen per wedstrijd, team, seizoen en totaal.
- Correcties aan een verwerkte wedstrijd veilig doorrekenen zonder statistieken dubbel te tellen.
- Transfers, dubbele teamlidmaatschappen en spelers die in meerdere teams uitkomen correct verwerken.
- Alleen bevestigde wedstrijdgegevens meetellen in officiële statistieken.
- Een controleoverzicht tonen vóór de wedstrijd definitief wordt verwerkt.
- Later uitbreidbaar houden voor kaarten, clean sheets, tegendoelpunten, schoten en andere statistieken.

**Belangrijke datakeuze:** wedstrijdgebeurtenissen blijven de bron van waarheid; totalen per speler worden daarvan afgeleid of opnieuw berekend. Zo blijven correcties controleerbaar en ontstaan er geen losse, tegenstrijdige tellers.

**Status:** later uitwerken als onderdeel van de vernieuwde wedstrijdverwerking.

## Onderzoek

Er staan momenteel geen nieuwe items in deze categorie.

## Nieuw idee toevoegen

Gebruik voor elk nieuw idee minimaal:

```text
### Titel

Doel:
Waarom:
Gewenst gedrag:
Prioriteit: Nu / Later / Onderzoek
Afhankelijkheden of open vragen:
```
