# Plaatsing en productchecklist

## Wat waar hoort

### 1. Altijd bereikbare juridische pagina’s

Publiceer afzonderlijke routes:

- `/privacy` — volledige privacyverklaring;
- `/terms` — gebruiksvoorwaarden;
- `/kinderen-en-beelden` — korte regels in begrijpelijke taal;
- `/subprocessors` — actuele leveranciers, doel, locatie en doorgiftegrond;
- `/report` of een duidelijk e-mailadres — beeld/privacy melden zonder account.

Link ernaar in de footer van de homepage, login, registratie, dashboard en publieke clippagina. Op een publieke clip moet “Meld dit beeld” naast de speler staan, niet alleen onderaan.

### 2. Registratie van een coachaccount

Plaats direct boven “Sign Up” een niet vooraf aangevinkt verplicht selectievak:

> Ik ben minstens 18 jaar, ben bevoegd om voor mijn organisatie te handelen en ga akkoord met de Gebruiksvoorwaarden. Ik heb de Privacyverklaring gelezen.

Link “Gebruiksvoorwaarden” en “Privacyverklaring” afzonderlijk. Log voorwaardenversie, privacyversie, tijdstip, account-ID en technisch noodzakelijke bewijsgegevens. Aanvaarding van voorwaarden en kennisname van privacyinformatie zijn geen toestemming voor optionele marketing; gebruik daarvoor een apart, optioneel vak.

### 3. Een team/speler importeren of toevoegen

Toon vóór opslaan/importeren een verplichte verklaring zodra gegevens van derden worden ingevoerd:

> Ik bevestig dat ik bevoegd ben om deze spelers-/contactgegevens in te voeren, dat de betrokkenen (en waar vereist hun ouder/voogd) de nodige privacy-informatie kregen en dat ik een geldige, aantoonbare rechtsgrond heb.

Maak geboortedatum, e-mail en telefoon optioneel en leg naast die velden uit waarom ze nodig zijn. Overweeg geboortejaar/leeftijdscategorie in plaats van volledige geboortedatum. Bewaar bij voorkeur niet “toestemming = ja”, maar doel, versie van informatie, wie verklaarde, datum en eventuele intrekking.

### 4. Video openen of uploaden

Toon in het bestaande keuzescherm een korte vaste uitleg:

> De volledige wedstrijdvideo blijft op dit apparaat en wordt niet naar Clipboard Coach geüpload. Metadata en korte clips die u bewust maakt om online te bekijken of te delen, kunnen wel online worden opgeslagen.

Vereis vóór de eerste video per team/seizoen een verklaring:

> Ik ben bevoegd om dit beeld voor analyse te gebruiken en heb spelers, tegenstanders en andere betrokkenen geïnformeerd en waar vereist toestemming verkregen.

Herhaal de verklaring bij een gewijzigd doel, seizoen of privacyversie, niet gedachteloos bij elke klik. Bewaar bewijs van de verklaring.

### 5. Clip maken en delen

Direct vóór het aanmaken van een publieke deellink:

> Iedereen met deze link kan de clip zonder account bekijken en doorsturen. Ik heb gecontroleerd dat deze personen voor dit doel mogen worden getoond en deel alleen met het bedoelde publiek.

Bied standaard een vervaldatum, “link intrekken”, doelgroepcontrole en een overzicht van actieve links. Gebruik geen tekst “shared securely” zonder nuance: een geheime link is toegangsbeperking, maar geen garantie tegen doorsturen.

### 6. Publieke clippagina

Plaats zichtbaar:

- wie de clip plaatste (minstens club/organisatie, indien veilig);
- doelgroep-/doorstuurwaarschuwing;
- vervaldatum indien van toepassing;
- “Meld dit beeld / vraag verwijdering”;
- links naar privacy en kinderen-en-beelden;
- geen tracking of sociale embeds zonder noodzakelijke keuze/toestemming.

### 7. Instellingen/account

Voeg een sectie “Privacy & data” toe met:

- gegevens exporteren;
- account en data verwijderen;
- teamleden/contactgegevens corrigeren of verwijderen;
- actieve deellinks beheren en intrekken;
- privacyverzoeken en datalekken melden;
- huidige juridische versies en aanvaardingsdatum;
- bewaartermijnen in gewone taal.

## Technische punten vóór lancering

1. Gebruik geen publiek leesbare R2-bucket voor video’s. Lever objecten via korte, ondertekende URL’s na autorisatie. Een onraadbare object-URL is geen volwaardige toegangscontrole.
2. Stel een standaard vervaldatum voor deellinks in en maak intrekking onmiddellijk effectief.
3. Implementeer verwijdering in database én objectopslag, inclusief mislukte uploads en afgeleide HLS-/clipbestanden.
4. Implementeer een automatische opruimtaak voor de vastgelegde bovengrens van twee jaar, plus 30 dagen voor verwijderde gegevens in tijdelijke back-ups en 90 dagen voor gewone beveiligingslogs.
5. Houd een register van verwerkingen, leveranciers/subverwerkers, doorgiften, toegangsrollen en incidenten bij.
6. Sluit verwerkersovereenkomsten met leveranciers en bied er één aan clubs/organisaties wanneer Clipboard Coach verwerker is.
7. Beperk admins technisch en organisatorisch; log gevoelige admininzage en geef alleen toegang bij noodzaak.
8. Test export, correctie, accountverwijdering, linkintrekking en verwijderingsverzoeken end-to-end.
9. Voer vóór functies zoals spelertracking, gezichts-/persoonsherkenning, uitgebreide jeugdprofilering of grootschalige scouting een DPIA uit.
10. Maak een proces voor urgente kindveiligheidsmeldingen en onrechtmatige/intieme inhoud, met tijdelijke blokkering en escalatie.

## Open beslissingen

- Is de bestaande functie “Upload full video” uit de applicatie, API en documentatie verwijderd en zijn eventueel eerder geüploade bronvideo’s aantoonbaar verwijderd?
- Wie is contractueel de klant: individuele coach of club? Dit bepaalt rollen, bevoegdheid en de verwerkersovereenkomst.
- Welke EER-regio’s zijn werkelijk ingesteld bij Supabase, R2, Netlify en eventuele workerhosting?
- Hoe lang blijven clips, tags, teamgegevens, logs, back-ups en verwijderde accounts bestaan?
- Zijn clippagina’s alleen link-toegankelijk of ook indexeerbaar? Voeg minimaal `noindex` toe en voorkom previews die kinderbeelden onbedoeld kopiëren.
- Welke leeftijdsgroepen bedient het product en wie behandelt verzoeken van ouders of kinderen?
