# Juridisch pakket Clipboard Coach Studio (werkversie)

Deze map bevat Nederlandstalige conceptteksten voor de webversie van Clipboard Coach Studio:

- `PRIVACYVERKLARING_CONCEPT.md`: informatie voor betrokkenen volgens de AVG.
- `GEBRUIKSVOORWAARDEN_CONCEPT.md`: afspraken met coaches, clubs en andere accountgebruikers.
- `BEELDEN_EN_MINDERJARIGEN.md`: korte, begrijpelijke regels voor sportbeelden en kinderen.
- `TOESTEMMINGSFORMULIER_CLUB.md`: model dat een club of coach kan aanpassen en bewaren.
- `PLAATSING_EN_PRODUCTCHECKLIST.md`: waar elke tekst en verklaring in het product hoort.

## Nog invullen vóór publicatie

Zoek in deze bestanden naar `[INVULLEN]`. Minstens de volgende gegevens ontbreken nog:

- eventuele rechtsvorm/ondernemingsregistratie van Jurn Trio;
- ondernemingsnummer en vestigings-/postadres;
- privacy- en support-e-mailadres;
- volledige lijst van leveranciers, locaties en doorgiftemechanismen;
- rolverdeling met professionele klanten (verwerkingsverantwoordelijke/verwerker);
- toepasselijk recht en bevoegde rechtbank.

Laat de definitieve teksten, de verwerkersovereenkomst en de concrete toestemmingsflow nakijken door een Belgische privacyjurist. Een privacyverklaring alleen maakt het product niet AVG-conform: techniek, contracten, bewaartermijnen, verwijdering, toegangsbeheer en incidentafhandeling moeten ermee overeenstemmen.

## In het product geïmplementeerd

- `/privacy`, `/terms` en `/children-and-images` in Nederlands en Engels;
- verplichte 18+/bevoegdheidsverklaring bij registratie;
- onveranderbare registratie van juridische versies en aanvaardingsdatum via migratie `0012_legal_acceptances.sql`;
- gegevensexport, intrekken van alle deellinks en accountverwijdering via Instellingen;
- verwijdering van korte clip- en tekenbestanden uit R2 bij accountverwijdering;
- zichtbare juridische links op publieke en ingelogde pagina's;
- `noindex` voor publieke clippagina's.

Pas vóór uitrol de Supabase-migratie `0012_legal_acceptances.sql` toe. Laat de gepubliceerde teksten juridisch nakijken en vul ondernemings- en adresgegevens aan zodra die beschikbaar zijn.

## Gebruikte referenties

Deze concepten zijn niet overgenomen uit voorwaarden van concurrenten. De structuur en aandachtspunten zijn getoetst aan:

- [AVG, met name artikelen 5, 6, 8, 12–14, 15–22, 28, 32–35 en 44–49](https://eur-lex.europa.eu/legal-content/NL/TXT/?uri=CELEX:32016R0679);
- [Belgische GBA — toestemming als rechtsgrond en digitale toestemming vanaf 13 jaar](https://www.dataprotectionauthority.be/professioneel/avg/rechtsgronden/toestemming);
- [Belgische GBA — toestemming bij gerichte en niet-gerichte beelden](https://www.dataprotectionauthority.be/burger/thema-s/recht-op-afbeelding/wet-van-30-juli-2018/het-beginsel-van-de-toestemming-);
- [Belgische GBA — recht op afbeelding](https://www.dataprotectionauthority.be/professioneel/thema-s/recht-op-afbeelding);
- [EDPB — gegevens rechtmatig verwerken](https://www.edpb.europa.eu/sme-data-protection-guide/process-personal-data-lawfully_en);
- [Hudl Privacy Policy](https://www.hudl.com/privacy), waaronder de aparte behandeling van coachaccounts, door klanten ingevoerde sportbeelden en kinderen;
- [Hudl Organization Terms](https://www2.hudl.com/eula), waaronder de verantwoordelijkheid van organisaties voor informeren en ouderlijke toestemming;
- [LongoMatch EULA](https://longomatch.com/en/eula/), als vergelijking voor lokale software, eigendom en verantwoordelijkheid voor gebruikersinhoud.

Controleer deze bronnen opnieuw bij juridische review; beleid en wetstoepassing kunnen wijzigen.
