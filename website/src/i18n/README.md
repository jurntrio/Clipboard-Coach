# Internationalisatie

Clipboard Coach gebruikt een kleine, getypeerde i18n-laag zonder extra runtime-afhankelijkheid.

- `config.ts` bevat ondersteunde talen, labels, cookie en standaardtaal.
- `messages.ts` bevat alle vertaalsleutels. Nederlands is de brontaal en TypeScript vereist dat elke andere taal exact dezelfde sleutels bevat.
- `client.tsx` levert `useI18n()` aan clientcomponenten.
- `server.ts` leest dezelfde taalcookie in servercomponenten.

## Een taal toevoegen

1. Voeg de taalcode toe aan `locales` in `config.ts` en geef ze een label in `localeLabels`.
2. Voeg in `messages.ts` een volledig woordenboek met type `Record<MessageKey, string>` toe.
3. Voeg dat woordenboek toe aan de geëxporteerde `messages`.
4. Voer `npm run typecheck` uit. Ontbrekende of fout gespelde sleutels worden dan gemeld.

Gebruik in clientcomponenten `const { t } = useI18n()` en in servercomponenten `const { t } = getServerI18n()`. Dynamische waarden gebruiken `{naam}` in de vertaling en `t("sleutel", { naam: waarde })` in clientcomponenten.

Zet nieuwe zichtbare tekst niet rechtstreeks in JSX of foutmeldingen, maar voeg altijd eerst een sleutel toe. Productnamen, bestandsformaten en door gebruikers ingevoerde namen worden niet vertaald.

