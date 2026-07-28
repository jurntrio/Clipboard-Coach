# Intradesk: gedeelde trainingsbibliotheek

## Afbakening

Intradesk is voorlopig uitsluitend de gedeelde bibliotheek met trainingen en oefeningen van
een club. Het is geen algemene documentenbibliotheek en bevat geen spelersdossiers of
evaluaties.

Evaluaties blijven bij de individuele speler in het spelersgedeelte van CBCS.

## Relatie tussen Training en Intradesk

De module **Training** is de werkplek waar een trainer:

- een nieuwe training opbouwt;
- oefeningen tekent en beschrijft;
- een bestaande training opent om ermee te werken;
- een training bewaart als persoonlijk concept;
- een training publiceert naar Intradesk.

**Intradesk** is de gezamenlijke bibliotheek waar gepubliceerde trainingen en oefeningen later
kunnen worden teruggevonden, hergebruikt en verbeterd.

Kort:

```text
Training = maken en plannen
Intradesk = samen bewaren, terugvinden en verbeteren
```

## Indeling

De bibliotheek wordt primair ingedeeld per leeftijdscategorie, bijvoorbeeld:

```text
Intradesk
├── Algemeen
├── U6
├── U7
├── U8
├── ...
├── U15
├── U17
└── Senioren
```

Een training of losse oefening krijgt:

- een titel;
- één leeftijdscategorie;
- een thema, bijvoorbeeld opbouw, druk zetten, afwerken of omschakeling;
- een korte beschrijving;
- het aanbevolen aantal spelers;
- benodigd materiaal;
- de maker;
- de datum van de laatste wijziging;
- een versiegeschiedenis.

**Algemeen** is bedoeld voor inhoud die niet aan één leeftijdscategorie gebonden is.

Later kunnen filters worden toegevoegd voor thema, aantal spelers, duur of materiaal. Voor de
eerste versie volstaan categorie, zoekveld en eventueel thema.

## Toegang

Alle actieve trainers van dezelfde club mogen:

- alle gepubliceerde trainingen en oefeningen in Intradesk bekijken, ongeacht hun eigen
  leeftijdscategorie of team;
- zoeken en filteren door alle leeftijdscategorieën;
- een training of oefening openen;
- die inhoud gebruiken als basis voor een eigen training;
- een bestaande training of oefening aanpassen;
- een nieuwe versie bewaren.

Een U15-trainer kan dus ook de oefeningen van U13 of U17 bekijken en verbeteren. De
leeftijdscategorie dient om inhoud te ordenen, niet om toegang af te schermen.

Spelers en ouders krijgen voorlopig geen toegang tot Intradesk. Clubadmin-viewers kunnen de
bibliotheek bekijken, maar niet aanpassen.

## Aanpassen zonder verwijderen

Iedere actieve trainer mag gedeelde inhoud aanpassen, maar een trainer mag een gepubliceerde
training of oefening niet definitief verwijderen.

Bij aanpassen wordt de bestaande gepubliceerde versie niet overschreven. CBCS bewaart een
nieuwe versie met:

- wie de wijziging maakte;
- wanneer de wijziging gebeurde;
- een korte wijzigingsnotitie;
- de vorige inhoud.

Daardoor kan een wijziging altijd worden nagekeken en kan indien nodig een eerdere versie
worden teruggezet.

Aanbevolen werkwijze:

1. trainer opent een training of oefening;
2. trainer kiest **Aanpassen**;
3. trainer bewaart de wijziging als nieuwe versie;
4. de nieuwe versie wordt de actuele versie;
5. oudere versies blijven in de geschiedenis beschikbaar.

Voor kleine wijzigingen is geen ingewikkelde goedkeuringsflow nodig. Indien gewenst kan de
clubadmin later instellen dat nieuwe versies eerst moeten worden goedgekeurd, maar dat hoeft
niet in de eerste versie.

## Verwijderen en archiveren

De knop **Verwijderen** wordt niet getoond aan trainers.

Om foutieve, dubbele of verouderde inhoud uit de normale bibliotheek te halen:

- trainers kunnen **Archivering aanvragen**;
- een clubadmin kan een training of oefening archiveren;
- alleen een clubadmin kan inhoud definitief verwijderen;
- definitief verwijderen gebeurt bewust en met bevestiging;
- archiveren heeft de voorkeur, omdat de geschiedenis dan bewaard blijft.

Gearchiveerde inhoud verdwijnt uit de gewone resultaten, maar kan door een clubadmin worden
bekeken en teruggezet.

## Persoonlijk concept versus gedeelde inhoud

Niet elke begonnen training hoeft onmiddellijk clubinhoud te worden.

- **Persoonlijk concept**: alleen zichtbaar en aanpasbaar door de maker.
- **Gepubliceerd in Intradesk**: zichtbaar en aanpasbaar door alle actieve trainers van de club.
- **Gearchiveerd**: niet zichtbaar in de gewone bibliotheek; beheerd door de clubadmin.

Bij publiceren kiest de trainer de juiste leeftijdscategorie en het thema. Vanaf dat moment is
de training gezamenlijk clubmateriaal en niet langer uitsluitend van de oorspronkelijke maker.

## Eenvoudige interface

De Intradesk-pagina bevat:

- een zoekveld;
- categorieknoppen of een categoriefilter;
- eventueel een themafilter;
- kaarten of een lijst met trainingen en losse oefeningen;
- sortering op laatst gewijzigd, recent toegevoegd en alfabetisch.

Elke kaart toont minimaal:

- titel;
- categorie;
- thema;
- aantal oefeningen;
- maker;
- laatst aangepast door en datum.

Op de detailpagina staan:

- **Openen**;
- **Gebruiken in nieuwe training**;
- **Aanpassen**;
- **Versiegeschiedenis**;
- **Archivering aanvragen** voor trainers;
- **Archiveren** en **Verwijderen** alleen voor clubadmins.

## Rollen

| Rol | Bekijken | Toevoegen | Aanpassen | Archiveren | Verwijderen |
|---|---:|---:|---:|---:|---:|
| Trainer / assistent-trainer | Ja | Ja | Ja, als nieuwe versie | Aanvragen | Nee |
| Teammanager | Te bepalen | Te bepalen | Te bepalen | Nee | Nee |
| Analist | Ja | Te bepalen | Te bepalen | Nee | Nee |
| Clubadmin | Ja | Ja | Ja | Ja | Ja |
| Clubadmin-viewer | Ja | Nee | Nee | Nee | Nee |
| Speler / ouder | Nee | Nee | Nee | Nee | Nee |

Voor de eerste implementatie worden `trainer`, `coach` en `assistant_coach` als trainer
behandeld. De rechten van teammanagers en analisten worden pas geactiveerd nadat daar een
expliciete productkeuze over is gemaakt.

## Minimaal datamodel

Voor de eerste versie zijn drie onderdelen voldoende:

### Training of oefening

- club;
- type: volledige training of losse oefening;
- titel, beschrijving en thema;
- leeftijdscategorie of Algemeen;
- actuele versie;
- status: concept, gepubliceerd of gearchiveerd;
- maker en tijdstippen.

### Versie

- gekoppelde training of oefening;
- volledige inhoud van die versie;
- versienummer;
- wijzigingsnotitie;
- gemaakt door en gemaakt op.

### Archiveringsaanvraag

- gekoppelde training of oefening;
- aangevraagd door;
- reden;
- status: open, goedgekeurd of afgewezen.

Er is voorlopig geen algemeen rechtenmodel per map, team of persoon nodig. Toegang volgt
rechtstreeks uit de actieve clubrol.

## Autorisatieregels

De server en database dwingen minimaal af:

- alleen actieve trainers en clubadmins van dezelfde club zien gepubliceerde inhoud;
- trainers kunnen inhoud aanmaken en een nieuwe versie toevoegen;
- trainers kunnen gepubliceerde versies niet overschrijven of verwijderen;
- alleen clubadmins kunnen archiveren, herstellen of definitief verwijderen;
- clubadmin-viewers hebben uitsluitend leestoegang;
- persoonlijke concepten zijn alleen zichtbaar voor de maker en clubadmins;
- iedere wijziging bewaart maker, tijdstip en vorige versie.

## Eerste implementatiefase

1. Training Builder online laten bewaren als persoonlijk concept.
2. Publiceren naar Intradesk met categorie en thema.
3. Intradesk-overzicht met zoeken en categoriefilter.
4. Detailpagina met openen, hergebruiken en aanpassen.
5. Bij elke aanpassing automatisch een nieuwe versie bewaren.
6. Versiegeschiedenis tonen en een vorige versie kunnen herstellen.
7. Archivering laten aanvragen door trainers.
8. Archiveren en verwijderen uitsluitend aan clubadmins geven.
9. Database- en API-tests toevoegen voor trainer, clubadmin, clubadmin-viewer en gebruiker van
   een andere club.

## Acceptatiecriteria

- Iedere actieve trainer van een club ziet alle gepubliceerde clubtrainingen en oefeningen.
- Een trainer kan ook inhoud van een andere leeftijdscategorie openen en aanpassen.
- Iedere aanpassing maakt een nieuwe versie en bewaart de vorige versie.
- Een trainer kan geen gepubliceerde training of oefening verwijderen.
- Een trainer kan wel vragen om inhoud te archiveren.
- Alleen een clubadmin kan archiveren, herstellen of definitief verwijderen.
- Spelers en ouders zien Intradesk niet.
- Evaluaties komen nergens in Intradesk voor en blijven bij de speler.
- Een gebruiker van club A kan geen inhoud of metadata van club B zien.
