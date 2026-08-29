# Clubrollen: omschakeling naar het canonieke model

Migratie `0181_canonical_club_role_access.sql` voltooit de overgang die in 0086-0108 begon.
Na toepassing bepalen actieve `person_accounts`, `club_people` en
`club_role_assignments` de toegang. `club_trainers` en de overige legacytabellen blijven
voorlopig bestaan als operationele projecties voor planning en historiek.

## Uitrol

1. Maak een databaseback-up.
2. Pas migratie 0181 toe vóór de bijbehorende applicatiecode wordt uitgerold.
3. Voer vanuit `website/` `npm run audit:club-roles` uit.
4. Controleer iedere rij waarvan `actie` niet `unchanged` is.
5. Bevestig dat `jurn@clipboardcoachstudio.com` in `profiles.account_role` de waarde
   `platform_admin` heeft.
6. Test minimaal aanmelden, club wisselen, rollen wijzigen, teamtoegang en rol beëindigen.
7. Verwijder de legacytabellen pas nadat alle niet-autorisatieconsumers afzonderlijk zijn
   gemigreerd. Hun aanwezigheid betekent niet meer dat ze autoritatief zijn.

Het auditcommando eindigt met statuscode 2 wanneer handmatige controle nodig is. Dat is een
bewuste uitrolblokkering, geen scriptfout.
