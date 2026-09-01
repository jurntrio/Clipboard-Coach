import type { Locale } from "./config";

const nl = {
  "common.backHome": "Terug naar home",
  "common.close": "Sluiten",
  "common.cancel": "Annuleren",
  "common.save": "Opslaan",
  "common.add": "Toevoegen",
  "common.saving": "Opslaan…",
  "common.remove": "Verwijderen",
  "common.edit": "Bewerken",
  "common.play": "afspelen",
  "common.help": "Hulp",
  "common.training": "Training",
  "common.admin": "Beheer",
  "common.teams": "Teams",
  "common.videoViewer": "Videoviewer",
  "common.clips": "Clips",
  "common.matches": "Wedstrijden",
  "matchHub.title": "Alles rond je wedstrijden",
  "matchHub.subtitle": "Bereid wedstrijden voor, laat mensen live taggen en bekijk clips per speler.",
  "matchHub.new": "Nieuwe wedstrijd",
  "matchHub.edit": "Wedstrijd bewerken",
  "matchHub.prepare": "Kies de spelers en tagknoppen die je tijdens deze wedstrijd nodig hebt.",
  "matchHub.upcoming": "Gepland en live",
  "matchHub.finished": "Afgewerkte wedstrijden",
  "matchHub.noUpcoming": "Nog geen geplande wedstrijden.",
  "matchHub.noFinished": "Nog geen afgewerkte wedstrijden.",
  "matchHub.linkFailed": "De taglink kon niet worden gemaakt.",
  "matchHub.linkCopied": "De externe taglink staat op het klembord.",
  "matchHub.required": "Selecteer een team en vul de tegenstander in.",
  "matchHub.allTeams": "Alle ploegen",
  "matchHub.copyTagLink": "Taglink kopiëren",
  "matchHub.addVideo": "Video toevoegen",
  "matchHub.deleteMatch": "Wedstrijd verwijderen",
  "matchHub.teamClips": "Clips voor de volledige ploeg",
  "matchHub.noTeamClips": "Nog geen ploegclips",
  "matchHub.colPlayer": "Speler",
  "matchHub.colSelectedClips": "Geselecteerde clips",
  "matchHub.colTaggedClips": "Individueel getagd",
  "matchHub.colShare": "Deel",
  "matchHub.shareAllWith": "Alle clips delen met {name}",
  "matchHub.noPlayersAssigned": "Nog geen spelers aangeduid.",
  "matchHub.homeTeam": "Thuisploeg",
  "matchHub.homeTeamPlaceholder": "Typ of kies een team",
  "matchHub.awayTeam": "Bezoekers",
  "matchHub.date": "Datum",
  "matchHub.kickoffTime": "Aanvangsuur",
  "matchHub.status": "Status",
  "matchHub.scheduled": "Gepland",
  "matchHub.live": "Live",
  "matchHub.finishedStatus": "Afgewerkt",
  "matchHub.homeScore": "Score thuis",
  "matchHub.awayScore": "Score uit",
  "matchHub.participatingPlayers": "Spelers die deelnemen",
  "matchHub.chooseTeamFirst": "Kies eerst een team.",
  "matchHub.liveTagButtons": "Tagknoppen voor deze wedstrijd",
  "matchHub.removeTag": "{name} verwijderen",
  "matchHub.addTag": "Tag toevoegen",
  "matchHub.newTagPlaceholder": "Nieuwe tag",
  "matchHub.suggestions": "Suggesties",
  "matchHub.manageTagLibrary": "Tagbibliotheek beheren",
  "matchHub.deleteClipTitle": "Clip verwijderen",
  "matchHub.confirmDeleteClip": "Clip \"{name}\" definitief verwijderen?",
  "matchHub.clipDeleteFailed": "De clip kon niet worden verwijderd.",
  "matchHub.clipDeleted": "Clip \"{name}\" is verwijderd.",
  "matchHub.deleteMatchTitle": "Wedstrijd verwijderen",
  "matchHub.confirmDeleteMatch": "Wedstrijd \"{name}\" en de gekoppelde gegevens definitief verwijderen?",
  "matchHub.matchDeleteFailed": "De wedstrijd kon niet worden verwijderd.",
  "matchHub.matchDeleted": "Wedstrijd \"{name}\" is verwijderd.",
  "matchHub.noClipsToShare": "Er zijn nog geen clips om met {name} te delen.",
  "matchHub.shareIntro": "Trainer {coach} heeft deze clips met je gedeeld van de wedstrijd {match}{dateSuffix}.",
  "matchHub.shareDateSuffix": " op {date}",
  "matchHub.shareTitle": "Clips van {match}",
  "matchHub.defaultCoachName": "Je trainer",
  "matchHub.lineupCount": "{count} spelers",
  "clubTeams.heading": "Teams",
  "clubTeams.subtitle": "Maak teams en spelerslijsten vooraf klaar en wijs coaches toe.",
  "clubTeams.namePlaceholder": "Teamnaam",
  "clubTeams.create": "Team aanmaken",
  "clubTeams.saveFailed": "Wijziging kon niet worden bewaard.",
  "clubTeams.coachesLabel": "Coaches: {names}",
  "clubTeams.noCoachAssigned": "nog niemand toegewezen",
  "clubTeams.noTeamsYet": "Deze club heeft nog geen teams.",
  "clubTeams.readingFile": "Bestand lezen…",
  "clubTeams.columnsNotFound": "Kolommen Voornaam en Naam werden niet gevonden.",
  "clubTeams.noUsablePlayers": "Geen bruikbare spelers gevonden.",
  "clubTeams.importedCount": "{count} spelers ingelezen. Controleer en bewaar de lijst.",
  "clubTeams.fileReadFailed": "Bestand kon niet gelezen worden.",
  "clubTeams.rosterSaveFailed": "Spelerslijst kon niet worden bewaard.",
  "clubTeams.allSaved": "Alles bewaard — {count} spelers.",
  "clubTeams.trainerCanEditRoster": "Trainer mag spelerslijst beheren",
  "clubTeams.trainerCanEditRosterHelp": "Als dit uitstaat kan een toegewezen trainer de spelers wel bekijken en gebruiken, maar niet wijzigen.",
  "clubTeams.assignCoaches": "Coaches toewijzen",
  "clubTeams.trainerCanManageMatches": "Trainer mag wedstrijden beheren",
  "clubTeams.trainerCanManageMatchesHelp": "Als dit uitstaat, kunnen toegewezen trainers wedstrijden bekijken en gebruiken, maar niet zelf aanmaken, wijzigen of verwijderen.",
  "clubTeams.chooseCoaches": "Kies coaches…",
  "clubTeams.selectedCoachCount": "{count} coach(es) geselecteerd",
  "clubTeams.automaticMatches": "Automatische wedstrijden",
  "clubTeams.automaticMatchesHelp": "Voeg bij voorkeur de kalenderlink van deze ploeg op Voetbal Vlaanderen toe. Foot24 blijft ondersteund als aanvullende bron.",
  "clubTeams.calendarConfigured": "Kalenderlink ingesteld — vul alleen iets in om ze te vervangen",
  "clubTeams.testAndSync": "Link testen en synchroniseren",
  "clubTeams.enableAutomaticSync": "Automatisch synchroniseren",
  "clubTeams.syncNow": "Nu synchroniseren",
  "clubTeams.lastSync": "Laatst: {date}",
  "clubTeams.calendarSaveFailed": "Kalender kon niet worden bewaard.",
  "clubTeams.calendarSaved": "Kalenderinstellingen bewaard.",
  "clubTeams.calendarChecking": "Kalender controleren…",
  "clubTeams.calendarSyncFailed": "Synchronisatie mislukt.",
  "clubTeams.calendarNoChanges": "Geen wijzigingen.",
  "clubTeams.calendarSyncResult": "{imported} nieuw, {updated} bijgewerkt.",
  "matchHub.showAllUpcoming": "Alle komende wedstrijden tonen",
  "matchHub.showFirstThree": "Alleen de eerste 3 tonen",
  "matchPrep.open": "Wedstrijd voorbereiden",
  "matchPrep.title": "Wedstrijdvoorbereiding",
  "matchPrep.general": "Algemene info",
  "matchPrep.selection": "Selectie",
  "matchPrep.field": "Veld",
  "matchPrep.homeMatch": "Thuiswedstrijd",
  "matchPrep.lockerRoom": "Kleedkamer",
  "matchPrep.meetingPlace": "Afspraakplaats",
  "matchPrep.meetingTime": "Afgesproken tijdstip",
  "matchPrep.departureTime": "Vertrekuur gebruiken",
  "matchPrep.other": "Andere…",
  "matchPrep.enterPlace": "Vul de afspraakplaats in",
  "matchPrep.selected": "Geselecteerd",
  "matchPrep.notSelected": "Niet geselecteerd",
  "matchPrep.available": "Beschikbaar",
  "matchPrep.reason": "Reden niet geselecteerd",
  "matchPrep.note": "Extra info",
  "matchPrep.individualAttention": "Individueel aandachtspunt",
  "matchPrep.loadFailed": "Wedstrijdvoorbereiding kon niet worden geladen.",
  "matchPrep.saveFailed": "Wedstrijdvoorbereiding kon niet worden bewaard.",
  "clubMatchOptions.title": "Infrastructuur en afwezigheden",
  "clubMatchOptions.subtitle": "Beheer centrale keuzelijsten voor trainingen en wedstrijden. Nieuwe waarden zijn meteen beschikbaar bij het plannen.",
  "clubMatchOptions.fields": "Velden",
  "clubMatchOptions.fieldsHelp": "Velden waarop trainingen en thuiswedstrijden kunnen plaatsvinden.",
  "clubMatchOptions.lockerRooms": "Kleedkamers",
  "clubMatchOptions.lockerRoomsHelp": "Kleedkamers die bij trainingen en thuiswedstrijden gekozen kunnen worden.",
  "clubMatchOptions.meetingPlaces": "Afspraakplaatsen",
  "clubMatchOptions.meetingPlacesHelp": "Vaste afspraakplaatsen, standaard met Kleedkamer.",
  "clubMatchOptions.reasons": "Afwezigheidsredenen",
  "clubMatchOptions.reasonsHelp": "Standaardredenen voor afwezigheid bij trainingen en wedstrijden. Voeg hier eigen clubredenen aan toe.",
  "clubMatchOptions.saveFailed": "De waarde kon niet worden toegevoegd.",
  "clubMatchOptions.removeFailed": "De waarde kon niet worden verwijderd.",
  "clubTeams.notRegisteredYet": "nog te registreren",
  "clubTeams.roster": "Spelerslijst",
  "clubTeams.importHelp": "Importeer een ProSoccerData Excel-bestand of pas de lijst manueel aan.",
  "clubTeams.choosePsdFile": "PSD-bestand kiezen",
  "clubTeams.addPlayer": "Speler toevoegen",
  "clubTeams.firstNamePlaceholder": "Voornaam",
  "clubTeams.lastNamePlaceholder": "Naam",
  "clubTeams.phonePlaceholder": "Gsm",
  "clubTeams.saveHint": "Wijzigingen aan de spelerslijst worden pas bewaard wanneer je bovenaan op {save} klikt.",
  "clubTeams.removeDisabledTooltip": "Verwijderen kan hier niet rechtstreeks — gebruik 'Synchroniseren' of 'Volledig vervangen' na een nieuwe import.",
  "clubTeams.importMode.merge": "Toevoegen/bijwerken",
  "clubTeams.importMode.sync": "Synchroniseren",
  "clubTeams.importMode.replace": "Volledig vervangen",
  "clubTeams.importModeHint.merge": "Bestaande spelers van dit team worden nooit verwijderd. Contactgegevens die botsen met een ander team worden nooit stilzwijgend overschreven — dat gaat naar de clubadmin.",
  "clubTeams.importModeHint.sync": "Na een nieuwe import kan je zelf kiezen welke ontbrekende spelers het team verlaten.",
  "clubTeams.importModeHint.replace": "Elke speler die niet in het geïmporteerde bestand staat, verlaat het team — enkel na expliciete bevestiging.",
  "clubTeams.importPreview": "{new} nieuw · {updated} bijgewerkt · {missing} niet in bestand",
  "clubTeams.syncMissingHeading": "Deze spelers staan niet in het geïmporteerde bestand. Vink aan wie het team mag verlaten.",
  "clubTeams.replaceWarning": "Deze spelers staan niet in het geïmporteerde bestand en worden bij bevestigen uit het team verwijderd.",
  "clubTeams.replaceConfirmLabel": "Ik bevestig dat deze {count} speler(s) volledig uit dit team verwijderd worden.",
  "clubTeams.replaceConfirmRequired": "Bevestig eerst de volledige vervanging hierboven.",
  "clubTeams.allSavedWithRemoved": "Alles bewaard — {count} spelers, {removed} verwijderd.",
  "clubTeams.addExistingHeading": "Voeg een bestaande speler toe aan dit team",
  "clubTeams.addExistingHelp": "Zoek een speler die al bij een ander team van deze club hoort.",
  "clubTeams.addExistingSearchPlaceholder": "Zoek op naam…",
  "clubTeams.currentlyOn": "speelt ook bij: {teams}",
  "clubTeams.addToTeam": "Toevoegen aan dit team",
  "clubTeams.addedToTeam": "{name} toegevoegd aan dit team.",
  "clubTeams.unassignedPrimaryHeading": "Kies een primair team",
  "clubTeams.unassignedPrimaryHelp": "Deze spelers spelen bij meerdere teams. Kies welk team hun primaire team is.",
  "clubTeams.choosePrimary": "Kies {team}",
  "settings.clipProfilesHelp": "Bepaal per tag hoeveel seconden vóór en na het tagmoment automatisch in de clip komen.",
  "clipProfiles.title": "Timing van tags",
  "clipProfiles.liveTags": "Live tags",
  "clipProfiles.liveTagsHelp": "Timing voor tags die tijdens een wedstrijd live worden geregistreerd.",
  "clipProfiles.videoTags": "Videotags",
  "clipProfiles.videoTagsHelp": "Timing voor tags die achteraf in de Video Viewer worden gemaakt.",
  "clipProfiles.tag": "Tag",
  "clipProfiles.startOffset": "Start t.o.v. tag",
  "clipProfiles.endOffset": "Stop t.o.v. tag",
  "clipProfiles.action": "Actie",
  "clipProfiles.seconds": "sec",
  "clipProfiles.needTwoNumbers": "Vul twee geldige getallen in.",
  "clipProfiles.needFourNumbers": "Vul voor Live tags en Videotags telkens een geldige start- en stoptijd in.",
  "clipProfiles.startMustBeBeforeEnd": "De startwaarde moet kleiner dan of gelijk aan de eindwaarde zijn.",
  "clipProfiles.savedNotice": "{name} is opgeslagen.",
  "clipProfiles.noTagsYet": "Voeg eerst snelle tags toe in Instellingen.",
  "playerPage.sharedClipsMatches": "Wedstrijden met gedeelde clips",
  "playerPage.matchesPlayed": "Wedstrijden gespeeld",
  "playerPage.goals": "Goals",
  "playerPage.assists": "Assists",
  "match.currentPosition": "Huidige positie in de video",
  "common.settings": "Instellingen",
  "common.exit": "Afmelden",
  "common.language": "Taal",
  "common.dark": "Donker",
  "common.light": "Licht",
  "common.back": "Terug",
  "common.delete": "Verwijderen",
  "common.working": "Bezig…",
  "training.title": "Training",
  "training.eyebrow": "Binnenkort beschikbaar",
  "training.body": "Hier bouw je binnenkort trainingen uit met een visuele tekentool. Je zult oefeningen op het veld kunnen uittekenen en bewaren voor later gebruik.",
  "home.eyebrow": "Wedstrijdanalyse, zonder ruis",
  "home.title": "Bekijk. Tag. Coach beter.",
  "home.intro": "Tag elk belangrijk moment op de tijdlijn, koppel acties aan je spelers en bouw een clipbibliotheek waar je team echt van leert.",
  "home.start": "Start met analyseren",
  "home.signIn": "Aanmelden",
  "home.roomsEyebrow": "Eén studio, vier ruimtes",
  "home.roomsTitle": "Alles wat een coach nodig heeft",
  "home.tagline": "Analyseer · Coach · Verbeter · Win",
  "home.heroTitle": "Maak van wedstrijdbeelden momenten die ertoe doen",
  "home.register": "Registreren",
  "home.videoBody": "Open een wedstrijdvideo, doorzoek de tijdlijn en plaats tijdstempeltags op momenten die je opnieuw wilt bekijken.",
  "home.teamsBody": "Stel teams samen, voeg spelers toe en koppel elke tag aan de juiste speler, zodat clips de juiste mensen bereiken.",
  "home.clipsBody": "Maak van getagde momenten een clipbibliotheek die je met het hele team of één speler kunt delen.",
  "home.settingsBody": "Snelle tags, spelersvolgorde en weergave, afgestemd op jouw werkwijze.",
  "home.trainingFeatureTitle": "Trainingen",
  "home.trainingFeatureBody": "Plan sessies, bouw oefeningen op het veld en volg de aanwezigheid van je spelers.",
  "home.intradeskFeatureTitle": "Intradesk",
  "home.intradeskFeatureBody": "Bewaar en hergebruik je beste oefenvormen in een overzichtelijke bibliotheek.",
  "home.discover": "Ontdek het platform",
  "home.platformEyebrow": "Van analyse tot clubbeleving",
  "home.platformTitle": "Meer dan wedstrijdvideo alleen",
  "home.platformBody": "Eén visueel platform voor coaches, spelers, media en iedereen rond de club.",
  "home.mediaEyebrow": "Trainingen",
  "home.mediaTitle": "Van weekplanning tot veldtekening",
  "home.mediaBody": "Bouw een complete training op, plan ze voor je team en hou iedereen mee in dezelfde voorbereiding.",
  "home.mediaPoint1": "Teken oefenvormen visueel uit op het veld",
  "home.mediaPoint2": "Plan trainingsblokken, duur en materiaal",
  "home.mediaPoint3": "Registreer aanwezigheid per speler",
  "home.screensEyebrow": "Videoanalyse",
  "home.screensTitle": "Zie meer in elke wedstrijd",
  "home.screensBody": "Bekijk wedstrijdbeelden, markeer sleutelmomenten en geef spelers feedback die meteen duidelijk is.",
  "home.screensPoint1": "Tag momenten rechtstreeks op de tijdlijn",
  "home.screensPoint2": "Koppel acties en clips aan spelers",
  "home.screensPoint3": "Teken looplijnen en aandachtspunten in beeld",
  "home.drawingEyebrow": "Intradesk",
  "home.drawingTitle": "Je oefenstof altijd binnen handbereik",
  "home.drawingBody": "Bundel eigen oefeningen en clubmateriaal in een visuele bibliotheek die je snel terugvindt en opnieuw gebruikt.",
  "home.drawingPoint1": "Filter op leeftijd, thema en trainingsdoel",
  "home.drawingPoint2": "Bewaar favoriete oefenvormen centraal",
  "home.drawingPoint3": "Voeg oefeningen rechtstreeks aan een training toe",
  "home.statisticsEyebrow": "Inzichten",
  "home.statisticsTitle": "Maak vooruitgang zichtbaar",
  "home.statisticsBody": "Volg aanwezigheid en trainingsritme doorheen het seizoen zonder losse lijsten of extra rekenwerk.",
  "home.statisticsPoint1": "Heldere evolutie per week en periode",
  "home.statisticsPoint2": "Overzicht per team en speler",
  "home.statisticsPoint3": "Signaleer trends voor ze verloren gaan",
  "home.ctaTitle": "Klaar om je club visueel sterker te maken?",
  "home.ctaBody": "Start met wedstrijdanalyse en groei door naar één visuele werking voor je hele club.",
  "auth.createCoach": "Coachaccount aanmaken",
  "auth.createIntro": "Begin binnen enkele minuten met beelden analyseren.",
  "auth.fullName": "Volledige naam",
  "auth.yourName": "Je naam",
  "auth.email": "E-mail",
  "auth.password": "Wachtwoord",
  "auth.passwordHint": "Minstens 6 tekens",
  "auth.showPassword": "Wachtwoord tonen",
  "auth.hidePassword": "Wachtwoord verbergen",
  "auth.signUp": "Registreren",
  "auth.creating": "Account aanmaken…",
  "auth.alreadyAccount": "Heb je al een account?",
  "auth.signIn": "Aanmelden",
  "auth.signingIn": "Aanmelden…",
  "auth.noAccount": "Nog geen account?",
  "auth.createOne": "Maak er een aan",
  "auth.almostThere": "Bijna klaar",
  "auth.checkEmail": "Controleer je e-mail om je account te bevestigen en meld je daarna aan.",
  "auth.goLogin": "Naar aanmelden",
  "auth.needHelp": "Hulp nodig?",
  "auth.realEmail": "Gebruik een echt e-mailadres — je moet op een bevestigingslink klikken voordat je kunt aanmelden.",
  "auth.passwordRule": "Het wachtwoord moet minstens 6 tekens bevatten.",
  "auth.welcomeBack": "Welkom terug",
  "auth.loginIntro": "Meld je aan bij je coachaccount.",
  "auth.confirmationHelp": "Geen bevestigingsmail ontvangen? Controleer je spammap — de mail wordt via Supabase verstuurd.",
  "auth.coachSignIn": "Aanmelden als coach",
  "auth.welcomeBackIntro": "Welkom terug. Ga verder waar je gebleven was.",
  "auth.yourPassword": "Je wachtwoord",
  "auth.needSignInHelp": "Hulp nodig bij aanmelden?",
  "auth.adultAgreement": "Ik ben minstens 18 jaar, ben bevoegd om voor mijn organisatie te handelen en ga akkoord met de Gebruiksvoorwaarden. Ik heb de Privacyverklaring gelezen.",
  "auth.forgotPassword": "Wachtwoord vergeten?",
  "auth.forgotPasswordTitle": "Wachtwoord vergeten",
  "auth.forgotPasswordIntro": "Vul je e-mailadres in en we sturen je een link om een nieuw wachtwoord in te stellen.",
  "auth.sendResetLink": "Verstuur resetlink",
  "auth.sendingResetLink": "Versturen…",
  "auth.resetLinkSent": "Check je e-mail",
  "auth.resetLinkSentIntro": "Als dat adres bij een account hoort, hebben we er een resetlink naartoe gestuurd. Controleer ook je spammap.",
  "auth.backToLogin": "Terug naar aanmelden",
  "auth.resetPasswordTitle": "Nieuw wachtwoord instellen",
  "auth.resetPasswordIntro": "Kies een nieuw wachtwoord voor je account.",
  "auth.newPassword": "Nieuw wachtwoord",
  "auth.confirmPassword": "Bevestig wachtwoord",
  "auth.passwordsDontMatch": "De wachtwoorden komen niet overeen.",
  "auth.updatePassword": "Wachtwoord instellen",
  "auth.updatingPassword": "Bezig…",
  "auth.resetLinkInvalid": "Deze link is ongeldig of verlopen. Vraag een nieuwe resetlink aan.",
  "auth.requestNewLink": "Nieuwe resetlink aanvragen",
  "settings.appearance": "Weergave",
  "settings.appearanceHelp": "Kies hoe Sport Visual Systems er op dit apparaat uitziet.",
  "settings.languageHelp": "Kies de taal van de interface op dit apparaat.",
  "settings.quickTags": "Snelle tags",
  "settings.quickTagsHelp": "Deze verschijnen als knoppen die je met één tik gebruikt in de videoviewer.",
  "settings.newQuickTag": "Nieuwe snelle tag",
  "settings.add": "Toevoegen",
  "settings.privacyTitle": "Privacy en gegevens",
  "settings.privacyHelp": "Bekijk hoe gegevens en beelden worden verwerkt of neem contact op voor een verzoek.",
  "settings.privacy": "Privacyverklaring",
  "settings.children": "Kinderen en beelden",
  "settings.contact": "Contact: info@sportvisualsystems.com",
  "settings.mailbox": "Mailbox",
  "settings.mailboxHelp": "Bepaal of je per nieuw mailboxbericht een e-mailnotificatie met de volledige tekst krijgt.",
  "settings.mailboxEmailLabel": "E-mailnotificatie met berichttekst ontvangen",
  "language.label": "Taal kiezen",
  "mailbox.title": "Mailbox",
  "mailbox.newMessage": "Nieuwe e-mail",
  "mailbox.noThreads": "Je mailbox is leeg.",
  "mailbox.noThreadSelected": "Selecteer een e-mailthread of schrijf een nieuwe e-mail.",
  "mailbox.loading": "Laden...",
  "mailbox.composeTitle": "Nieuwe e-mail",
  "mailbox.subject": "Onderwerp",
  "mailbox.subjectPlaceholder": "Bv. Trainingswijziging",
  "mailbox.body": "E-mailtekst",
  "mailbox.bodyPlaceholder": "Schrijf je e-mail...",
  "mailbox.emailNotice": "Ontvangers krijgen de volledige tekst als e-mailnotificatie, tenzij ze dit in hun instellingen uitschakelden. Antwoorden blijven centraal bewaard in deze mailbox.",
  "mailbox.inAppOnlyNotice": "Ontvangers zien dit bericht momenteel alleen in de CBC Studio-mailbox. E-mailnotificaties zijn nog niet geactiveerd.",
  "mailbox.recipients": "Ontvangers",
  "mailbox.noTeams": "Geen ploegen gevonden waar je berichten naartoe mag sturen.",
  "mailbox.staffOf": "Staf van {team}",
  "mailbox.contactsOf": "Contactpersonen van {team}",
  "mailbox.cancel": "Annuleren",
  "mailbox.send": "Versturen",
  "mailbox.sending": "Versturen...",
  "mailbox.missingFields": "Onderwerp, tekst en minstens één ontvanger zijn verplicht.",
  "mailbox.sendFailed": "Versturen mislukt.",
  "mailbox.replyPlaceholder": "Antwoord...",
  "mailbox.reply": "Beantwoorden",
  "mailbox.replyAll": "Allen beantwoorden",
  "mailbox.forward": "Doorsturen",
  "mailbox.actions": "E-mailacties",
  "mailbox.systemNoReply": "Dit is een automatisch bericht van Sports Visual Systems. Beantwoorden is niet mogelijk.",
  "mailbox.from": "Van",
  "mailbox.unknownSender": "Onbekend",
  "mailbox.delete": "Verwijderen",
  "mailbox.deleteTitle": "Gesprek verwijderen?",
  "mailbox.deleteMessage": "Dit gesprek verdwijnt alleen uit jouw inbox. Andere ontvangers behouden hun kopie.",
  "mailbox.deleteFailed": "Het gesprek kon niet verwijderd worden.",
  "mailbox.read": "Gelezen",
  "mailbox.unread": "Nog niet gelezen",
  "mailbox.readMark": "✓",
  "share.title": "Deze clip delen",
  "share.anyone": "Iedereen met deze link kan de clip zonder account bekijken en de link doorsturen.",
  "share.copy": "Kopiëren",
  "share.copied": "Gekopieerd!",
  "share.phone": "Delen via telefoon",
  "share.email": "E-mail",
  "share.review": "Ik heb gecontroleerd dat de personen in deze clip voor dit doel mogen worden getoond en deel de link alleen met het bedoelde publiek.",
  "share.secure": "Beperkte deellink via Sport Visual Systems",
  "share.report": "Dit beeld melden",
  "share.thisClip": "deze clip",
  "share.watch": "Bekijk {clip} van Sport Visual Systems",
  "share.emailSubject": "Een Sport Visual Systems-clip voor jou",
  "share.emailSubjectNamed": "Sport Visual Systems-clip: {name}",
  "share.clipTitle": "Sport Visual Systems-clip",
  "share.close": "Deelvenster sluiten",
  "share.copyLink": "Link kopiëren",
  "errors.sessionExpired": "Je sessie is verlopen. Meld je opnieuw aan en probeer nogmaals."
  ,"team.player": "Speler"
  ,"team.staff": "Staflid"
  ,"team.addPerson": "{role} toevoegen"
  ,"team.firstName": "Voornaam"
  ,"team.lastName": "Achternaam"
  ,"team.dateOfBirth": "Geboortedatum"
  ,"team.phoneNumbers": "Telefoonnummers"
  ,"team.phonePlaceholder": "Telefoonnummers, gescheiden door komma’s"
  ,"team.adding": "Toevoegen…"
  ,"team.editPlayer": "Speler bewerken"
  ,"team.updateDetails": "Persoons- en contactgegevens bijwerken."
  ,"team.team": "Team"
  ,"team.role": "Rol"
  ,"team.jerseyNumber": "Rugnummer"
  ,"team.position": "Positie"
  ,"team.saveChanges": "Wijzigingen opslaan"
  ,"team.couldNotSave": "Opslaan mislukt: {error}"
  ,"team.create": "Team aanmaken"
  ,"team.createIntro": "Voeg spelers handmatig toe of importeer een ProSoccerData-Excelbestand."
  ,"team.name": "Teamnaam"
  ,"team.importRoster": "Spelerslijst importeren"
  ,"team.importLocal": "Het bestand wordt lokaal ingelezen als voorbeeld en pas opgeslagen wanneer je het team aanmaakt."
  ,"team.gdprConfirm": "Ik bevestig dat ik toestemming of een andere geldige rechtsgrond heb om de persoonsgegevens van deze spelers te gebruiken en op te slaan."
  ,"team.chooseExcel": "Excelbestand kiezen"
  ,"team.players": "Spelers ({count})"
  ,"team.addPlayer": "+ Speler toevoegen"
  ,"team.creating": "Aanmaken…"
  ,"team.reading": "Spelerslijst lezen…"
  ,"team.noRows": "In dit bestand zijn geen spelersrijen gevonden."
  ,"team.missingColumns": "De kolommen ‘Voornaam’ en ‘Naam’ zijn niet gevonden."
  ,"team.noUsablePlayers": "In dit bestand zijn geen bruikbare spelers gevonden."
  ,"team.imported": "{count} spelers geïmporteerd. Controleer de lijst voordat je het team aanmaakt."
  ,"team.readFailed": "De spelerslijst kon niet worden gelezen."
  ,"team.createFailed": "Het team kon niet worden aangemaakt."
  ,"team.linkStaff": "Geregistreerd staflid uitnodigen"
  ,"team.linkStaffHelp": "Voer het exacte geregistreerde e-mailadres in. De gebruiker wordt pas staflid nadat die de uitnodiging aanvaardt."
  ,"team.registeredName": "Geregistreerd e-mailadres"
  ,"team.nameOrEmail": "naam@voorbeeld.be"
  ,"team.linking": "Uitnodigen…"
  ,"team.link": "Uitnodiging sturen"
  ,"team.linkFailed": "De uitnodiging kon niet worden verstuurd."
  ,"team.invitedTo": "Je bent uitgenodigd als staflid van {team}."
  ,"team.acceptInvitation": "Aanvaarden"
  ,"team.declineInvitation": "Weigeren"
  ,"team.removePlayer": "Speler verwijderen"
  ,"team.taggedClips": "{count} getagde clip(s)"
  ,"team.none": "Er zijn nog geen ploegen zichtbaar voor jouw account."
  ,"team.summary": "{players} spelers · {staff} stafleden"
  ,"team.delete": "Verwijderen"
  ,"team.registeredStaff": "Geregistreerd staflid"
  ,"team.addStaff": "Staflid toevoegen"
  ,"team.linkRegistered": "+ Geregistreerde gebruiker uitnodigen"
  ,"team.loading": "Ploegen laden…"
  ,"team.playerCount": "{count} spelers"
  ,"team.overview": "Overzicht"
  ,"team.staffTab": "Staff"
  ,"team.matchesOf": "Wedstrijden van {team}"
  ,"team.trainings": "Trainingen"
  ,"team.trainingsOf": "Trainingen van {team}"
  ,"team.evaluations": "Evaluaties"
  ,"team.evaluationsComingSoon": "Evaluaties volgen binnenkort."
  ,"team.tests": "Testen"
  ,"team.testsComingSoon": "Dit volgt later."
  ,"team.noStaff": "Er zijn nog geen staffleden aan deze ploeg gekoppeld."
  ,"team.noMatches": "Er zijn nog geen wedstrijden voor deze ploeg."
  ,"team.noTrainings": "Er zijn nog geen trainingen voor deze ploeg."
  ,"team.notFound": "Deze ploeg kon niet worden gevonden."
  ,"team.navigation": "Navigatie binnen de ploeg"
  ,"team.field": "Veld"
  ,"team.lockerRoom": "Kleedkamer"
  ,"team.openTraining": "Training openen"
  ,"team.roleTrainer": "Trainer"
  ,"team.roleAssistant": "Assistent-trainer"
  ,"team.roleManager": "Teamverantwoordelijke / afgevaardigde"
  ,"team.roleCoordinator": "Jeugdcoördinator"
  ,"team.roleYouthManager": "TVJO / hoofd jeugdopleiding"
  ,"team.roleTechnicalDirector": "Technisch directeur"
  ,"team.roleStaff": "Staff"
  ,"team.birthDate": "Geboortedatum"
  ,"team.phoneContact1": "Gsm CP 1"
  ,"team.phoneContact2": "Gsm CP 2"
  ,"team.emailContact1": "E-mail CP 1"
  ,"team.emailContact2": "E-mail CP 2"
  ,"team.goalkeeper": "Doelman"
  ,"team.loadingMatches": "Wedstrijden laden…"
  ,"team.loadingTrainings": "Trainingen laden…"
  ,"team.upcomingTrainings": "Komende trainingen"
  ,"team.pastTrainings": "Afgelopen trainingen"
  ,"team.noUpcomingTrainings": "Er zijn nog geen komende trainingen gepland."
  ,"team.weekOf": "Week van {start} – {end}"
  ,"team.deleteTeam": "Team verwijderen?"
  ,"team.removeLinked": "Gekoppeld staflid verwijderen?"
  ,"team.deletePlayer": "Speler verwijderen?"
  ,"team.deleteTeamMessage": "{name} en alle spelers en stafleden verwijderen? Dit kan niet ongedaan worden gemaakt."
  ,"team.removeMessage": "{name} uit dit team verwijderen? Dit kan niet ongedaan worden gemaakt."
  ,"team.activePlayers": "Actieve spelers"
  ,"team.noPlayers": "Dit team heeft nog geen spelers."
  ,"team.back": "Terug naar teams"
  ,"team.taggedTitle": "Getagde clips"
  ,"team.loadingClips": "Clips laden…"
  ,"team.untitledVideo": "Video zonder titel"
  ,"team.noTaggedClips": "Er zijn nog geen clips met een tag voor deze speler."
  ,"share.createFailed": "De deellink kon niet worden aangemaakt."
  ,"video.open": "Video openen"
  ,"video.formats": "MP4, MOV of M4V"
  ,"video.dialogIntro": "Gebruik een wedstrijdvideo van deze computer of ga verder waar je gebleven was."
  ,"video.useLocal": "Video van deze computer gebruiken"
  ,"video.localPrivacy": "De volledige wedstrijd blijft lokaal; alleen bewust gemaakte korte clips kunnen worden geüpload."
  ,"video.previous": "Vorige video’s"
  ,"video.nonePrevious": "Nog geen eerdere video’s."
  ,"video.untitled": "Video zonder titel"
  ,"video.local": "LOKAAL"
  ,"video.ready": "Video gereed"
  ,"video.checking": "Lokale video controleren…"
  ,"video.savingDetails": "Videogegevens opslaan…"
  ,"video.fullNotUploaded": "De volledige wedstrijd wordt niet geüpload."
  ,"video.localUnsupported": "Lokale clip-export ondersteunt momenteel MP4, MOV en M4V met H.264- of HEVC-video en AAC-audio."
  ,"video.localOpenFailed": "De lokale video kon niet worden geopend."
  ,"video.savedDrawing": "Opgeslagen coachtekening"
  ,"video.play": "Afspelen"
  ,"video.pause": "Pauzeren"
  ,"video.backFive": "5 seconden terug"
  ,"video.speed": "Afspeelsnelheid"
  ,"match.edit": "Wedstrijd bewerken"
  ,"match.teamA": "Team A"
  ,"match.teamB": "Team B"
  ,"match.date": "Datum"
  ,"match.startTime": "Starttijd"
  ,"match.recordingStartTime": "Start van de opname"
  ,"match.recordingStartTimeHelp": "Wanneer de camera begon op te nemen (niet de aftrap). Gebruikt om live tags op de juiste plek te zetten."
  ,"match.videoManagement": "Videobeheer"
  ,"match.attendance": "Aanwezigheidslijst"
  ,"match.noAttendancePlayers": "Selecteer eerst een eigen team om spelers toe te voegen."
  ,"match.replacing": "Video’s vervangen…"
  ,"match.replace": "Wedstrijdvideo’s vervangen"
  ,"match.delete": "Wedstrijd verwijderen"
  ,"match.noDate": "Geen datum"
  ,"match.videoCount": "{count} video’s"
  ,"match.periodMarkers": "Periodemarkeringen"
  ,"match.reconnect": "Video {number} opnieuw verbinden"
  ,"match.reconnectHelp": "Selecteer de oorspronkelijke bestanden. De wedstrijd en tags zijn al opgeslagen."
  ,"match.browserReconnect": "Deze browser kan lokale bestanden niet automatisch herstellen. Gebruik Chrome of Edge voor blijvende toegang."
  ,"match.reconnectAll": "Alle video’s opnieuw verbinden"
  ,"match.onlyVideo": "Alleen video {number}"
  ,"match.videoSequence": "Volgorde wedstrijdvideo’s"
  ,"match.videoNumber": "Video {number}"
  ,"match.reconnectShort": "opnieuw verbinden"
  ,"match.notFound": "Wedstrijd niet gevonden."
  ,"match.deleteTitle": "Wedstrijd verwijderen?"
  ,"match.deleteMessage": "Deze wedstrijd en de exclusief gekoppelde video’s, tags en clips verwijderen? Dit kan niet ongedaan worden gemaakt."
  ,"match.customTeam": "Aangepaste teamnaam"
  ,"video.playback": "Afspelen"
  ,"video.noVideo": "Geen video"
  ,"match.new": "Nieuwe wedstrijd"
  ,"match.older": "Oudere wedstrijden"
  ,"match.localIntro": "Wedstrijden en tags worden opgeslagen; volledige video’s blijven lokaal op deze computer."
  ,"match.createNew": "Nieuwe wedstrijd aanmaken"
  ,"match.last": "Afgelopen wedstrijden"
  ,"match.open": "Openen"
  ,"match.noRecent": "Geen afgelopen wedstrijd"
  ,"match.viewOlder": "Alle afgelopen wedstrijden bekijken"
  ,"match.noneSaved": "Nog geen opgeslagen wedstrijden."
  ,"match.searchPlaceholder": "Zoek op ploegnaam..."
  ,"match.loadMore": "Meer laden"
  ,"match.noSearchResults": "Geen wedstrijden gevonden."
  ,"match.loadFailed": "Kon wedstrijden niet laden."
  ,"match.information": "Wedstrijdgegevens"
  ,"match.enterName": "Naam invoeren"
  ,"match.videos": "Wedstrijdvideo’s"
  ,"match.playOrder": "Ze worden automatisch in deze volgorde afgespeeld."
  ,"match.addMore": "Meer toevoegen"
  ,"match.sourceFile": "Bestand kiezen"
  ,"match.sourceExternal": "Externe opname"
  ,"match.source360": "360-link"
  ,"match.360Link": "Link naar 360-video"
  ,"match.360LinkHelp": "Plak een beveiligde videolink. De link wordt centraal bij de wedstrijd bewaard en is beschikbaar voor alle bevoegde gebruikers."
  ,"match.360Video": "360-wedstrijdbeeld"
  ,"match.360Invalid": "Gebruik een geldige beveiligde 360-videolink (https)."
  ,"match.recordingId": "Opnamenummer"
  ,"match.recordingIdHelp": "Voer het opnamenummer van de 360-camera-opname in (bv. 1391450) en duid aan welke camera's gefilmd hebben."
  ,"match.sourceVeo": "Veo-link"
  ,"match.veoLink": "Publieke Veo-wedstrijdlink"
  ,"match.veoLinkHelp": "Plak een publieke link van app.veo.co. Clipboard Coach opent de follow-cam in de Video Viewer."
  ,"match.resolvingVeo": "Veo-video ophalen..."
  ,"match.veoFollowCam": "Veo follow-cam"
  ,"match.veoResolveFailed": "De Veo-video kon niet worden geopend."
  ,"match.camerasUsed": "Gebruikte camera's"
  ,"match.cameraLabel": "Camera {number}"
  ,"match.cameraSwitch": "Camera wisselen"
  ,"match.camera": "Camera"
  ,"match.attachVideos": "Video's toevoegen"
  ,"match.attachVideosHelp": "Deze wedstrijd heeft nog geen video. Voeg een externe opname of bestand toe."
  ,"match.manageSources": "Videobronnen beheren"
  ,"match.sourceName": "Naam"
  ,"match.sourceLink": "Videolink"
  ,"match.cameraNumber": "Cameranummer (optioneel)"
  ,"match.cameraAlreadyAdded": "Deze camera is al gekoppeld"
  ,"match.camerasAlreadyAdded": "Alle geselecteerde camera's zijn al aan deze wedstrijd gekoppeld."
  ,"match.updateSourceFailed": "De videobron kon niet worden gewijzigd."
  ,"match.editRecording": "360SI-opname aanpassen"
  ,"match.removeVideoConfirm": "'{name}' uit deze wedstrijd verwijderen? Tags die alleen bij deze bron horen worden ook verwijderd."
  ,"match.removeVideoFailed": "De videobron kon niet worden verwijderd."
  ,"match.attachAction": "Toevoegen"
  ,"match.back": "Terug"
  ,"match.working": "Bezig…"
  ,"match.createAction": "Wedstrijd aanmaken"
  ,"video.periodMarkers": "Periodemarkeringen"
  ,"video.periodTimes": "Periodetijden"
  ,"video.phaseTags": "Fase-tags"
  ,"phaseTag.start": "Start fase"
  ,"phaseTag.stop": "Stop"
  ,"phaseTag.dialogTitle": "Naam van de fase"
  ,"phaseTag.namePlaceholder": "bv. Balbezit"
  ,"phaseTag.save": "Fase opslaan"
  ,"video.addClipTag": "Cliptag toevoegen"
  ,"video.draw": "Tekenen"
  ,"video.reconnectTitle": "Lokale wedstrijdvideo opnieuw verbinden"
  ,"video.reconnectHelp": "Je tags zijn online opgeslagen, maar de volledige wedstrijd blijft op deze computer. Selecteer hetzelfde bestand om verder te gaan."
  ,"video.selectOriginal": "Oorspronkelijke video selecteren"
  ,"video.taggedClips": "Getagde clips"
  ,"video.match": "Wedstrijd"
  ,"liveTags.title": "Live tags"
  ,"liveTags.subtitle": "Momenten die tijdens de wedstrijd via de taglink zijn binnengekomen."
  ,"liveTags.by": "door {name}"
  ,"liveTags.byUnknown": "door onbekende tagger"
  ,"liveTags.unknownTagger": "Onbekende tagger"
  ,"liveTags.taggersFilter": "Live-taggers"
  ,"liveTags.filters": "Filters"
  ,"liveTags.tagTypesFilter": "Tags"
  ,"liveTags.taggersFilterHelp": "Toon tags van:"
  ,"tag.tagsTitle": "Tags"
  ,"liveTags.goTo": "Ga naar moment"
  ,"liveTags.calibrate": "Herijken"
  ,"liveTags.calibrateHelp": "Speel naar het echte moment van '{name}' en bevestig dan."
  ,"liveTags.calibrateConfirm": "Bevestig op huidige positie"
  ,"liveTags.reviewed": "Verwerkt"
  ,"liveTags.delete": "Live tag verwijderen"
  ,"match.deleteNamed": "{name} verwijderen"
  ,"match.deleteNamedMessage": "{name} en de exclusief gekoppelde video’s, tags en clips verwijderen? Dit kan niet ongedaan worden gemaakt."
  ,"match.autoReconnectUnavailable": "Automatisch opnieuw verbinden is niet beschikbaar in deze browser. Open Clipboard Coach in Chrome of Edge en kies ‘Toestaan bij elk bezoek’."
  ,"match.browserCannotRemember": "Deze browser kan toegang tot lokale video’s niet onthouden. Je kunt de wedstrijd aanmaken, maar moet de bestanden later opnieuw verbinden. Chrome of Edge kan ze wel onthouden."
  ,"tag.add": "+ Tag"
  ,"tag.new": "Nieuwe tag"
  ,"tag.name": "Tagnaam"
  ,"tag.addAction": "Tag toevoegen"
  ,"tag.selectForClip": "{name} selecteren voor clip"
  ,"tag.deleteNamed": "{name} verwijderen"
  ,"tag.draw": "Tekenen"
  ,"tag.time": "Tijd"
  ,"tag.start": "Start"
  ,"tag.end": "Einde"
  ,"tag.seconds": "sec"
  ,"tag.none": "Nog geen tags. Speel de video af en tik op een tagknop."
  ,"tag.bands": "Tagbanden"
  ,"tag.example": "bv. Kans"
  ,"tag.alreadyExists": "Die tag bestaat al."
  ,"tag.periodMarker": "Periodemarkering"
  ,"tag.editDrawingAt": "Tekening bewerken op {time}"
  ,"tag.drawingAt": "Tekening op {time}"
  ,"timeline.match": "Wedstrijdtijdlijn"
  ,"timeline.periodMarkers": "Periodemarkeringen"
  ,"drawing.title": "Tekenen op beeld"
  ,"drawing.minimize": "Verkleinen"
  ,"drawing.maximize": "Maximaliseren"
  ,"drawing.showFor": "Tonen gedurende"
  ,"drawing.seconds": "seconden"
  ,"drawing.saveFailed": "De tekening kon niet worden opgeslagen."
  ,"clip.create": "Clip maken"
  ,"clip.selected": "{count} cliptags geselecteerd"
  ,"clip.segmentOrder": "Volgorde van de clipmomenten"
  ,"clip.segmentOrderHelp": "Gebruik de pijlen om te bepalen in welke volgorde de momenten in de samengestelde clip komen."
  ,"clip.moveUp": "{name} omhoog zetten"
  ,"clip.moveDown": "{name} omlaag zetten"
  ,"clip.estimatedRemaining": "Schatting: nog ±{minutes} min"
  ,"clip.estimateHelp": "Dit is een schatting op basis van het aantal fragmenten. Grote videobestanden en meerdere camera's kunnen langer duren."
  ,"clip.renderProgress": "{completed} van {total} fragmenten klaar"
  ,"clip.chooseAudience": "Kies wie deze clip kan terugvinden."
  ,"clip.camerasPerTag": "Camera's per tag"
  ,"clip.camerasPerTagHelp": "Elke aangeduide camera wordt een afzonderlijk fragment. Kies dus alleen Camera 1 als je elk moment maar één keer wilt zien."
  ,"clip.name": "Clipnaam"
  ,"clip.selectTeam": "Selecteer een team"
  ,"clip.fullTeam": "Volledig geselecteerd team"
  ,"clip.includesPlayers": "Omvat alle {count} hieronder getoonde spelers."
  ,"clip.teamPlayers": "Spelers in geselecteerd team ({count})"
  ,"clip.noTeamPlayers": "Nog geen spelers in dit team."
  ,"clip.addPlayerName": "Naam van speler toevoegen"
  ,"clip.making": "Clip maken…"
  ,"clip.creating": "Aanmaken…"
  ,"clip.share": "Delen"
  ,"clip.previewClose": "Sluiten"
  ,"clip.noPlayer": "Geen speler toegewezen"
  ,"clip.sharedWith": "Gedeeld met:"
  ,"clip.delete": "Clip verwijderen"
  ,"clip.deleteTitle": "Clip verwijderen?"
  ,"clip.deleteMessage": "{name}, deellinks en alle geüploade videosegmenten verwijderen? Dit kan niet ongedaan worden gemaakt."
  ,"clip.deleteFailed": "De clip kon niet worden verwijderd."
  ,"clip.fullSelectedTeam": "Volledig geselecteerd team"
  ,"clip.noPlayersSelected": "Geen spelers geselecteerd"
  ,"clip.count": "{count} clips"
  ,"clip.noneForMatch": "Voor deze wedstrijd zijn nog geen clips gemaakt."
  ,"clip.otherVideos": "Andere video’s"
  ,"clip.notLinked": "Clips die niet aan een wedstrijd zijn gekoppeld"
  ,"clip.none": "Nog geen wedstrijden of clips."
  ,"clip.audience": "Doelgroep:"
  ,"clip.segments": "{count} segmenten"
  ,"clip.segment": "1 segment"
  ,"clip.untitledMatch": "Wedstrijd zonder titel"
  ,"clip.make": "Clip maken"
  ,"clip.team": "Team"
  ,"clip.match": "Wedstrijd"
  ,"clip.add": "Toevoegen"
  ,"clip.freeUsed": "{used}/{limit} gratis clips gebruikt"
  ,"clip.proPlan": "Pro-abonnement · Onbeperkte clips ({count} gemaakt)"
  ,"clip.freeLimit": "Je hebt alle 20 clips van een gratis account gebruikt. Upgrade naar Pro om meer clips te maken."
  ,"tag.tooLong": "Deze clip mag maximaal 3 minuten duren, tekeningen inbegrepen."
  ,"clip.reconnectAll": "Koppel alle bronvideo’s van deze wedstrijd opnieuw om clips te kunnen maken."
  ,"clip.reconnectOriginal": "Koppel de oorspronkelijke wedstrijdvideo opnieuw voordat je clips maakt."
  ,"clip.selectPerson": "Selecteer minstens één persoon of kies het volledige team."
  ,"clip.selectFullTeam": "Selecteer een team voordat je het volledige team kiest."
  ,"clip.selectSavedTeam": "Selecteer een opgeslagen team voordat je een speler toevoegt."
  ,"clip.preparing": "Clip voorbereiden…"
  ,"clip.saving": "Clip opslaan…"
  ,"clip.makingSegment": "Segment {current} van {total} maken…"
  ,"clip.uploadingSegment": "Segment {current} van {total} uploaden…"
  ,"clip.reconnectSegment": "Koppel de bronvideo voor segment {current} opnieuw."
  ,"clip.conversionFailed": "De conversie naar een mobiel compatibele clip kon niet worden gestart."
  ,"clip.uploadedPreparing": "Clip geüpload. De mobiele versie wordt voorbereid…"
  ,"clip.processing": "Wordt verwerkt…"
  ,"clip.creationFailed": "Het maken van de clip is mislukt."
  ,"clip.keepOpen": "Laat deze pagina open. De volledige wedstrijd blijft op deze pc."
  ,"clip.play": "Afspelen"
  ,"clip.pause": "Pauzeren"
  ,"clip.position": "Clippositie"
  ,"clip.fullscreen": "Volledig scherm"
  ,"clip.openDirectly": "Video rechtstreeks openen"
  ,"clip.playFailed": "Deze clip kon niet door deze browser worden afgespeeld."
  ,"clip.formatUnsupported": "Deze clip gebruikt een videoformaat dat deze browser niet kan afspelen. Probeer Chrome, Safari of een nieuw aangemaakte mobiel compatibele clip."
  ,"help.teamsTitle": "Teams en spelers"
  ,"help.teamsBody": "Voeg een team toe via Teams en open het om spelers toe te voegen. Elke speler krijgt automatisch een avatar met zijn initialen."
  ,"help.videoTitle": "Een video openen"
  ,"help.videoBody": "Open een lokale wedstrijdvideo vanuit de videoviewer. De volledige video blijft op je computer en wordt niet naar de cloud geüpload."
  ,"help.tagTitle": "Taggen"
  ,"help.tagBody": "Open een video, selecteer bij Actieve spelers wie op het veld staat en tik tijdens het afspelen op een snelle tag. Tags verschijnen op het huidige tijdstip in de tijdlijn."
  ,"help.clipTitle": "Een clip maken"
  ,"help.clipBody": "Vink in de taglijst de momenten aan die je wilt gebruiken, geef de clip een naam en doelgroep en kies Clip maken. Alleen de korte clipsegmenten worden geüpload."
  ,"help.shareTitle": "Een clip delen"
  ,"help.shareBody": "Open een clip via Clips en kies Delen. Iedereen met de link kan de clip zonder account bekijken, dus deel hem alleen met het bedoelde publiek."
  ,"public.sharedClip": "Gedeelde clip"
  ,"public.unavailable": "Clip niet online beschikbaar"
  ,"public.unavailableBody": "Deze link bevat geen geüploade video. Maak de clip opnieuw terwijl alle oorspronkelijke wedstrijdvideo’s gekoppeld zijn en deel daarna de nieuwe clip."
  ,"public.madeWith": "Gemaakt met Sport Visual Systems"
  ,"public.tagline": "Bekijk wedstrijden, tag momenten en deel de clips die ertoe doen."
  ,"public.start": "Maak je eigen clips"
  ,"admin.subtitle": "Coaches, teams en opslag voor alle accounts"
  ,"admin.coaches": "Coaches"
  ,"admin.players": "Spelers"
  ,"admin.videos": "Video’s"
  ,"admin.failed": "Mislukt"
  ,"admin.storage": "Cloudopslag"
  ,"admin.viewVideos": "Alle video’s bekijken →"
  ,"admin.coach": "Coach"
  ,"admin.joined": "Geregistreerd"
  ,"admin.plan": "Abonnement"
  ,"admin.status": "Status"
  ,"admin.blocked": "Geblokkeerd"
  ,"admin.active": "Actief"
  ,"admin.noneCoaches": "Nog geen coaches."
  ,"admin.failedCount": "({count} mislukt)"
  ,"admin.allVideosSubtitle": "Alle wedstrijdvideo’s van alle coaches"
  ,"admin.backOverview": "← Terug naar beheeroverzicht"
  ,"admin.video": "Video"
  ,"admin.uploaded": "Geüpload"
  ,"admin.cloudSize": "Cloudgrootte"
  ,"admin.untitled": "Zonder titel"
  ,"admin.localOnly": "Alleen lokaal"
  ,"admin.noneVideos": "Nog geen video’s."
  ,"admin.lastSignIn": "Laatste aanmelding {date}"
  ,"admin.emailUnconfirmed": "E-mailadres niet bevestigd"
  ,"admin.playerCount": "{count} spelers"
  ,"admin.noneTeams": "Nog geen teams."
  ,"admin.free": "Gratis"
  ,"admin.toFree": "Naar gratis abonnement"
  ,"admin.markPro": "Als Pro markeren"
  ,"admin.unblockAccount": "Account deblokkeren"
  ,"admin.blockAccount": "Account blokkeren"
  ,"admin.deleteAccount": "Account verwijderen"
  ,"admin.genericError": "Er ging iets mis."
  ,"admin.makeClubAdmin": "Club Admin maken"
  ,"admin.removeClubAdmin": "Club Admin verwijderen"
  ,"admin.unblockTitle": "Account deblokkeren?"
  ,"admin.blockTitle": "Account blokkeren?"
  ,"admin.unblockMessage": "{email} opnieuw laten aanmelden?"
  ,"admin.blockMessage": "{email} kan zich niet meer aanmelden totdat het account wordt gedeblokkeerd."
  ,"admin.unblock": "Deblokkeren"
  ,"admin.block": "Blokkeren"
  ,"admin.deleteTitle": "Account permanent verwijderen?"
  ,"admin.deleteMessage": "Hiermee verwijder je onmiddellijk {email}, inclusief alle teams, spelers, video’s en clips. Dit kan niet ongedaan worden gemaakt."
  ,"admin.clubManagement": "Clubbeheer"
  ,"admin.clubManagementSubtitle": "Bekijk bestaande clubs, voeg een club toe en wijs een Club Admin of Analyst toe."
  ,"admin.viewClubs": "Clubs bekijken en toevoegen"
  ,"admin.noRegistrationNumber": "Geen stamnummer"
  ,"admin.trainerCount": "{count} trainer"
  ,"admin.trainerCountPlural": "{count} trainers"
  ,"admin.clubAdminCount": "{count} Club Admin"
  ,"admin.clubAdminCountPlural": "{count} Club Admins"
  ,"admin.colName": "Naam"
  ,"admin.colTeams": "Ploeg(en)"
  ,"admin.colPhone": "GSM"
  ,"admin.colEmail": "E-mail"
  ,"admin.notLinkedYet": "Nog te koppelen"
  ,"admin.noneTrainersAssigned": "Nog geen trainers toegewezen."
  ,"admin.noneClubs": "Nog geen clubs toegevoegd."
  ,"admin.usersWithoutTeam": "Gebruikers zonder ploeg"
  ,"admin.usersWithoutTeamSubtitle": "Deze gebruikers hebben nog geen gewone ploeg of clubploeg toegewezen gekregen."
  ,"admin.assignTeam": "Ploeg toewijzen"
  ,"admin.everyoneHasTeam": "Iedere gebruiker heeft minstens één ploeg."
  ,"admin.colClub": "Club"
  ,"nav.home": "Home"
  ,"drawing.frameNotReady": "Het huidige videobeeld is nog niet klaar."
  ,"drawing.arrow": "Pijl"
  ,"drawing.dottedLine": "Stippellijn →"
  ,"drawing.circle": "Cirkel"
  ,"drawing.area": "Gebied"
  ,"drawing.text": "Tekst"
  ,"drawing.edit": "Bewerken"
  ,"drawing.color": "Kleur {color}"
  ,"drawing.chooseColor": "Kleur kiezen"
  ,"drawing.lineWidth": "Lijndikte"
  ,"drawing.lineWidthValue": "Lijndikte {width}"
  ,"drawing.deleteShape": "Vorm verwijderen"
  ,"drawing.deletePoint": "Punt verwijderen"
  ,"drawing.undo": "Ongedaan maken"
  ,"drawing.clearAll": "Alles wissen"
  ,"drawing.textHint": "Teken eerst een tekstvak (klik tweemaal) en voer daarna je tekst in."
  ,"drawing.areaHint": "Klik punten aan om een gebied te tekenen. Voeg minstens 3 punten toe en druk daarna op Enter of Gereed."
  ,"drawing.pointsHint": "{count} punten — klik om meer toe te voegen of voltooi het gebied."
  ,"drawing.done": "Gereed (Enter)"
  ,"drawing.textPlaceholder": "Tekst…"
  ,"drawing.editTextHint": "Bewerk de tekst en kleur of versleep hem."
  ,"drawing.place": "Plaatsen"
  ,"drawing.download": "Afbeelding downloaden"
  ,"match.drawInsideTag": "Tekenen is beschikbaar wanneer de tijdlijn zich binnen een tag bevindt."
  ,"tag.noLongerExists": "De geselecteerde tag bestaat niet meer."
  ,"match.wrongOriginal": "Dit is niet het oorspronkelijke bestand voor dit videoblok."
  ,"match.checkingSaved": "Opgeslagen video’s controleren…"
  ,"match.selectOriginalBeforeOpen": "Selecteer de oorspronkelijke videobestanden voordat je de viewer opent."
  ,"match.localReconnectFailed": "De lokale video’s konden niet opnieuw worden gekoppeld."
  ,"match.selectAllOriginals": "Selecteer alle {count} oorspronkelijke videobestanden voordat je deze wedstrijd opent."
  ,"match.originalsMissing": "Een of meer oorspronkelijke wedstrijdvideo’s ontbreken nog. Selecteer alle wedstrijdvideo’s samen."
  ,"match.deleteFailed": "De wedstrijd kon niet worden verwijderd."
  ,"match.checkingVideo": "Video {number} controleren…"
  ,"match.createFailed": "De wedstrijd kon niet worden aangemaakt."
  ,"match.creating": "Wedstrijd aanmaken…"
  ,"match.savingVideo": "Video {current} van {total} opslaan…"
  ,"nav.account": "Account"
  ,"video.unsupportedFormat": "Niet-ondersteund videoformaat. Kies een MP4-, MOV-, M4V- of WebM-bestand."
  ,"media.unreadable": "Deze videocontainer kan niet in de browser worden gelezen."
  ,"media.noVideoTrack": "In dit bestand is geen videospoor gevonden."
  ,"media.videoCodec": "Lokale clipexport ondersteunt H.264- en HEVC-video. Dit bestand gebruikt {codec}."
  ,"media.audioCodec": "Lokale clipexport vereist AAC-audio. Dit bestand gebruikt {codec}."
  ,"media.durationUnknown": "De duur van de video kon niet worden bepaald."
  ,"media.largeClipsUnsupported": "Deze browser kan geen grote lokale clips maken. Gebruik een recente versie van Chrome, Edge of Firefox."
  ,"media.incompatibleClip": "Deze clip kan niet zonder conversie worden gekopieerd. Gebruik H.264- of HEVC-video met AAC-audio."
  ,"media.noKeyframe": "Voor deze tag is geen bruikbaar keyframe gevonden."
  ,"legal.privacy": "Privacyverklaring"
  ,"legal.terms": "Gebruiksvoorwaarden"
  ,"legal.children": "Kinderen en beelden"
  ,"legal.report": "Beeld of privacyprobleem melden"
  ,"legal.version": "Versie {version}"
  ,"terms.title": "Gebruiksvoorwaarden"
  ,"terms.intro": "Deze voorwaarden gelden voor Sport Visual Systems, aangeboden door Jurn Trio. Contact: info@sportvisualsystems.com."
  ,"terms.accountTitle": "1. Account en leeftijd"
  ,"terms.accountBody": "Je moet minstens 18 jaar zijn en bevoegd zijn om voor jezelf of je organisatie te handelen. Je bent verantwoordelijk voor je account, toegangsgegevens en het gebruik door personen aan wie je toegang geeft."
  ,"terms.videosTitle": "2. Lokale video's en online clips"
  ,"terms.videosBody": "Volledige wedstrijdvideo's blijven lokaal. Alleen korte clips die je bewust maakt, tekeningen en bijbehorende gegevens kunnen online worden opgeslagen. Beschikbaarheid en compatibiliteit hangen mede af van je apparaat, browser en bronformaat."
  ,"terms.ownershipTitle": "3. Eigendom en verantwoordelijkheid"
  ,"terms.ownershipBody": "Je behoudt jouw rechten op geüploade inhoud. Je geeft Clipboard Coach alleen de beperkte toestemming die nodig is om de dienst uit te voeren. Jij blijft verantwoordelijk voor de inhoud, de personen op beelden, ingevoerde contactgegevens, de gekozen doelgroep en het verkrijgen en bewaren van vereiste toestemmingen of andere rechtsgronden."
  ,"terms.prohibitedTitle": "4. Verboden gebruik"
  ,"terms.prohibitedBody": "Gebruik de dienst niet voor onrechtmatige, misleidende, schadelijke of intimiderende inhoud, voor heimelijke monitoring of voor beelden waarvoor je niet bevoegd bent. Deel geen links breder dan nodig en respecteer verzoeken van spelers, ouders, clubs en andere betrokkenen."
  ,"terms.liabilityTitle": "5. Beschikbaarheid en aansprakelijkheid"
  ,"terms.liabilityBody": "De dienst wordt met redelijke zorg aangeboden, maar kan worden gewijzigd, onderbroken of fouten bevatten. Maak zelf back-ups van belangrijke lokale bestanden. Voor zover wettelijk toegestaan is Clipboard Coach niet aansprakelijk voor keuzes van gebruikers, verlies van lokale bronvideo's of onbevoegd doorsturen van deellinks."
  ,"terms.changesTitle": "6. Beëindiging en wijzigingen"
  ,"terms.changesBody": "Je kunt je account via Instellingen verwijderen. We kunnen toegang beperken bij misbruik, veiligheidsrisico's of wettelijke noodzaak. Bij wezenlijke wijzigingen vragen we waar nodig opnieuw akkoord."
  ,"privacyPolicy.title": "Privacyverklaring"
  ,"privacyPolicy.intro": "Sport Visual Systems wordt beheerd door Jurn Trio. Voor privacyvragen of verzoeken kun je contact opnemen via info@sportvisualsystems.com."
  ,"privacyPolicy.dataTitle": "1. Welke gegevens we verwerken"
  ,"privacyPolicy.dataBody": "We verwerken accountgegevens, team- en spelergegevens die je invoert, wedstrijdmetadata, tags, tekeningen, korte clips, doelgroepkeuzes, deellinks en technisch noodzakelijke beveiligingsgegevens. Volledige wedstrijdvideo's blijven lokaal op jouw apparaat en worden niet naar Clipboard Coach geüpload."
  ,"privacyPolicy.purposesTitle": "2. Doeleinden en rechtsgronden"
  ,"privacyPolicy.purposesBody": "We gebruiken gegevens om de dienst uit te voeren, accounts te beveiligen, clips op verzoek te verwerken en wettelijke verplichtingen na te komen. Dat gebeurt op basis van de overeenkomst, gerechtvaardigde beveiligingsbelangen en wettelijke verplichtingen. De gebruiker of organisatie die gegevens en beelden toevoegt, blijft verantwoordelijk voor een geldige rechtsgrond tegenover spelers en andere betrokkenen."
  ,"privacyPolicy.childrenTitle": "3. Beelden, kinderen en contactgegevens"
  ,"privacyPolicy.childrenBody": "Accounts zijn uitsluitend voor personen van 18 jaar of ouder. Beelden kunnen minderjarigen tonen. De uploader moet spelers, tegenstanders en andere betrokkenen informeren en waar nodig aantoonbare toestemming van een ouder of voogd verkrijgen. Voeg contactgegevens alleen toe wanneer je bevoegd bent en de betrokkene de nodige informatie kreeg."
  ,"privacyPolicy.sharingTitle": "4. Delen en leveranciers"
  ,"privacyPolicy.sharingBody": "Korte clips en bijbehorende gegevens kunnen worden verwerkt door hosting-, database-, opslag- en e-mailleveranciers die nodig zijn voor de dienst, waaronder Supabase en Cloudflare R2 volgens de feitelijke configuratie. Een publieke deellink kan worden doorgestuurd door ontvangers; deel hem daarom alleen met het bedoelde publiek."
  ,"privacyPolicy.retentionTitle": "5. Bewaring en beveiliging"
  ,"privacyPolicy.retentionBody": "Accountinhoud en korte clips bewaren we zolang dat nodig is voor de dienst, met een maximale reguliere bewaartermijn van twee jaar. Bij accountverwijdering verwijderen we actieve gegevens en online clipbestanden; tijdelijke back-ups en beveiligingslogs kunnen nog beperkt blijven bestaan volgens de technische back-up- en beveiligingscycli."
  ,"privacyPolicy.rightsTitle": "6. Jouw rechten"
  ,"privacyPolicy.rightsBody": "Je kunt inzage, correctie, verwijdering, beperking, overdracht of bezwaar vragen. In Instellingen kun je gegevens exporteren, deellinks intrekken en je account verwijderen. Je kunt ook contact opnemen via info@sportvisualsystems.com en een klacht indienen bij de Belgische Gegevensbeschermingsautoriteit."
  ,"childrenPolicy.title": "Kinderen en beelden"
  ,"childrenPolicy.subtitle": "Praktische regels voor sportbeelden"
  ,"childrenPolicy.intro": "Clipboard Coach-accounts zijn alleen voor volwassenen van minstens 18 jaar. Een volwassen coach of organisatie kan wel sportbeelden verwerken waarop kinderen staan, maar alleen met de juiste bevoegdheid en waar nodig toestemming."
  ,"childrenPolicy.beforeTitle": "Voor je beelden gebruikt"
  ,"childrenPolicy.inform": "Informeer spelers en ouders of voogden duidelijk over opname, analyse, clips en delen."
  ,"childrenPolicy.rules": "Controleer de regels van club, federatie, locatie en competitie."
  ,"childrenPolicy.consent": "Bewaar aantoonbare toestemming wanneer die vereist is, ook voor tegenstanders."
  ,"childrenPolicy.minimiseTitle": "Maak en deel zo weinig mogelijk"
  ,"childrenPolicy.minimiseBody": "Maak alleen clips die nodig zijn voor coaching. Deel ze met een beperkte doelgroep, zet geen gevoelige informatie in namen en trek links in zodra ze niet meer nodig zijn. Een ontvanger kan een link doorsturen of beelden opnemen."
  ,"childrenPolicy.contactTitle": "Contactgegevens"
  ,"childrenPolicy.contactBody": "Voeg e-mail, telefoonnummer of geboortedatum alleen toe als dit echt nodig is, je daarvoor bevoegd bent en de speler of ouder de nodige privacy-informatie heeft gekregen."
  ,"childrenPolicy.objectionTitle": "Bezwaar of verwijdering"
  ,"childrenPolicy.objectionBody": "Stop het gebruik en onderzoek een verzoek van een speler, ouder, voogd, club of andere betrokkene snel. Trek deellinks in en verwijder clips waar nodig. Meld een probleem via info@sportvisualsystems.com."
  ,"consent.title": "We hebben opnieuw je akkoord nodig"
  ,"consent.intro": "Onze juridische voorwaarden zijn bijgewerkt. Bekijk de actuele versies voordat je verdergaat."
  ,"consent.checkbox": "Ik ben minstens 18 jaar, ben bevoegd om voor mijn organisatie te handelen, aanvaard de Gebruiksvoorwaarden en heb de Privacyverklaring gelezen."
  ,"consent.submit": "Akkoord en doorgaan"
  ,"consent.saving": "Akkoord opslaan…"
  ,"consent.required": "Bevestig eerst dat je akkoord gaat."
  ,"consent.failed": "Je akkoord kon niet worden opgeslagen. Probeer het opnieuw."
  ,"auth.legalPrefix": "Ik ben minstens 18 jaar, ben bevoegd om voor mijn organisatie te handelen en ga akkoord met de"
  ,"auth.legalPrivacyPrefix": "Ik heb de"
  ,"auth.legalRequired": "Bevestig eerst de leeftijds-, bevoegdheids- en juridische verklaring."
  ,"privacy.title": "Privacy en gegevens"
  ,"privacy.retention": "Volledige wedstrijdvideo’s blijven lokaal. Online accountinhoud en korte clips worden maximaal twee jaar regulier bewaard."
  ,"privacy.export": "Mijn gegevens exporteren"
  ,"privacy.exportHelp": "Download een JSON-bestand met je accountgegevens, teams, spelers, wedstrijdmetadata, tags, clipnamen en -gegevens, deellinks en geregistreerde juridische aanvaardingen. De eigenlijke MP4-clipbestanden en volledige lokale video’s worden niet gedownload. Er wordt niets verwijderd."
  ,"privacy.revokeLinks": "Alle deellinks intrekken"
  ,"privacy.revokeLinksHelp": "Verwijder alle publieke toegangstokens. Alle bestaande links stoppen onmiddellijk met werken voor anderen. De clips blijven alleen in jouw ingelogde account beschikbaar en je kunt later nieuwe deellinks maken."
  ,"privacy.deleteAccount": "Account en gegevens verwijderen"
  ,"privacy.deleteAccountHelp": "Verwijder je account, databasegegevens en online korte clip- en tekenbestanden permanent. Volledige lokale video’s op je eigen computer worden niet verwijderd."
  ,"privacy.exportFailed": "De gegevensexport kon niet worden gemaakt."
  ,"privacy.actionFailed": "De actie kon niet worden uitgevoerd."
  ,"privacy.linksRevoked": "{count} deellinks zijn ingetrokken."
  ,"privacy.currentVersions": "Huidige versies — voorwaarden: {terms}; privacy: {privacy}."
  ,"privacy.accepted": "Aanvaard op {date} — voorwaarden: {terms}; privacy: {privacy}."
  ,"privacy.revokeTitle": "Alle deellinks intrekken?"
  ,"privacy.revokeMessage": "Alle actieve publieke links naar jouw clips stoppen onmiddellijk met werken. Je clips zelf blijven bestaan."
  ,"privacy.revokeConfirm": "Links intrekken"
  ,"privacy.deleteTitle": "Account en alle gegevens verwijderen?"
  ,"privacy.deleteMessage": "Dit verwijdert je account, teams, spelers, metadata, tags, tekeningen, korte online clips en deellinks permanent. Dit kan niet ongedaan worden gemaakt."
  ,"privacy.deleteConfirm": "Alles permanent verwijderen"
  ,"common.loading": "Laden…"
  ,"onboarding.title": "Club en team"
  ,"onboarding.existingClub": "Aansluiten bij een bestaande club"
  ,"onboarding.newClub": "Een nieuwe club registreren"
  ,"onboarding.searchClub": "Zoek op clubnaam"
  ,"onboarding.registrationNumber": "stamnummer"
  ,"onboarding.noClubs": "Geen geregistreerde clubs gevonden."
  ,"onboarding.officialClubName": "Officiële clubnaam"
  ,"onboarding.registrationOptional": "Stamnummer (optioneel)"
  ,"onboarding.similarWarning": "Deze club lijkt al te bestaan:"
  ,"onboarding.similarAcknowledge": "Ik heb dit gecontroleerd en wil toch een nieuwe club registreren."
  ,"onboarding.chooseTeam": "Kies je team"
  ,"onboarding.teamMissing": "Mijn team staat niet in de lijst"
  ,"onboarding.teamName": "Teamnaam"
  ,"onboarding.ageOptional": "Leeftijd (optioneel)"
  ,"onboarding.levelOptional": "Niveau/reeks (optioneel)"
  ,"onboarding.yourRole": "Jouw rol bij het team"
  ,"onboarding.roleCoach": "Trainer"
  ,"onboarding.roleAssistant": "Assistent-trainer"
  ,"onboarding.roleManager": "Teammanager"
  ,"onboarding.retryHint": "Je invoer blijft bewaard; probeer het opnieuw."
  ,"onboarding.clubRequired": "Kies eerst een bestaande club."
  ,"onboarding.newRequired": "Vul de officiële clubnaam en teamnaam in."
  ,"onboarding.teamRequired": "Kies een team of geef aan dat je team ontbreekt."
  ,"onboarding.teamNameRequired": "Vul een teamnaam in."
  ,"onboarding.similarConfirm": "Bevestig eerst dat je de gelijkende bestaande club hebt gecontroleerd."
  ,"guardianInvite.contacts": "Contactpersonen"
  ,"guardianInvite.contactNamePlaceholder": "Naam (bv. Mama)"
  ,"guardianInvite.contactPhonePlaceholder": "Gsm-nummer"
  ,"guardianInvite.addContact": "Nog een contactpersoon toevoegen"
  ,"guardianInvite.generateLink": "Genereer link"
  ,"guardianInvite.generating": "Bezig…"
  ,"guardianInvite.linkedGuardians": "Gekoppelde ouders/voogden"
  ,"guardianInvite.noneLinkedYet": "Nog niemand gekoppeld."
  ,"guardianInvite.pendingInvites": "Openstaande uitnodigingen"
  ,"guardianInvite.createdOn": "Aangemaakt op {date}, verloopt op {expiry}"
  ,"guardianInvite.copyLink": "Link kopiëren"
  ,"guardianInvite.cancel": "Annuleren"
  ,"guardianInvite.revoke": "Intrekken"
  ,"guardianInvite.since": "sinds {date}"
  ,"guardianInvite.revokedOn": "ingetrokken op {date}"
  ,"guardianInvite.unknownAccount": "Onbekend account"
  ,"guardianInvite.modalTitle": "Uitnodigingslink"
  ,"guardianInvite.modalBody": "Stuur deze link door aan de contactpersoon. Wie hiermee registreert, ziet enkel de wedstrijden en clips van {name}."
  ,"guardianInvite.copied": "Gekopieerd!"
  ,"guardianInvite.copyButton": "Kopiëren"
  ,"guardianInvite.childInfo": "Gegevens van het kind"
  ,"guardianInvite.address": "Adres"
  ,"guardianInvite.postalCode": "Postcode"
  ,"guardianInvite.city": "Gemeente"
  ,"guardianInvite.childPhone": "Telefoon (kind)"
  ,"guardianInvite.childEmail": "E-mail (kind)"
  ,"guardianInvite.noAddressYet": "Nog geen adres ingevuld."
  ,"guardianInvite.save": "Opslaan"
  ,"guardianInvite.saving": "Bezig met opslaan…"
  ,"guardianInvite.saved": "Opgeslagen."
  ,"guardianInvite.scopeCurrentSeason": "dit seizoen"
  ,"guardianInvite.scopeFromAcceptance": "vanaf aanvaarding"
  ,"guardianInvite.scopeAllHistory": "volledige geschiedenis"
  ,"guardianInvite.addressStillCorrect": "Deze gegevens kloppen nog"
  ,"guardianInvite.addressSectionTitle": "Adres van het kind"
  ,"clubModule.trainingDisabled": "Deze club heeft geen toegang tot de trainingstool."
  ,"clubModule.videoDisabled": "Deze club heeft geen toegang tot de Video Viewer."
  ,"clubModule.mediaDisabled": "Deze club heeft geen toegang tot Media / ClubTV."
} as const;

type MessageKey = keyof typeof nl;

const en: Record<MessageKey, string> = {
  "common.backHome": "Back to home",
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.add": "Add",
  "common.saving": "Saving…",
  "common.remove": "Remove",
  "common.edit": "Edit",
  "common.play": "play",
  "common.help": "Help",
  "common.training": "Training",
  "common.admin": "Admin",
  "common.teams": "Teams",
  "common.videoViewer": "Video Viewer",
  "common.clips": "Clips",
  "common.matches": "Games",
  "matchHub.title": "Everything around your games",
  "matchHub.subtitle": "Prepare games, let people tag live and open clips by player.",
  "matchHub.new": "New game",
  "matchHub.edit": "Edit game",
  "matchHub.prepare": "Choose the players and tag buttons needed for this game.",
  "matchHub.upcoming": "Scheduled and live",
  "matchHub.finished": "Finished games",
  "matchHub.noUpcoming": "No scheduled games yet.",
  "matchHub.noFinished": "No finished games yet.",
  "matchHub.linkFailed": "The tagging link could not be created.",
  "matchHub.linkCopied": "The external tagging link was copied.",
  "matchHub.required": "Select a team and enter the opponent.",
  "matchHub.allTeams": "All teams",
  "matchHub.copyTagLink": "Copy tag link",
  "matchHub.addVideo": "Add video",
  "matchHub.deleteMatch": "Delete match",
  "matchHub.teamClips": "Clips for the full team",
  "matchHub.noTeamClips": "No team clips yet",
  "matchHub.colPlayer": "Player",
  "matchHub.colSelectedClips": "Selected clips",
  "matchHub.colTaggedClips": "Individually tagged",
  "matchHub.colShare": "Share",
  "matchHub.shareAllWith": "Share all clips with {name}",
  "matchHub.noPlayersAssigned": "No players assigned yet.",
  "matchHub.homeTeam": "Home team",
  "matchHub.homeTeamPlaceholder": "Type or choose a team",
  "matchHub.awayTeam": "Away team",
  "matchHub.date": "Date",
  "matchHub.kickoffTime": "Kick-off time",
  "matchHub.status": "Status",
  "matchHub.scheduled": "Scheduled",
  "matchHub.live": "Live",
  "matchHub.finishedStatus": "Finished",
  "matchHub.homeScore": "Home score",
  "matchHub.awayScore": "Away score",
  "matchHub.participatingPlayers": "Players participating",
  "matchHub.chooseTeamFirst": "Choose a team first.",
  "matchHub.liveTagButtons": "Tag buttons for this game",
  "matchHub.removeTag": "Remove {name}",
  "matchHub.addTag": "Add tag",
  "matchHub.newTagPlaceholder": "New tag",
  "matchHub.suggestions": "Suggestions",
  "matchHub.manageTagLibrary": "Manage tag library",
  "matchHub.deleteClipTitle": "Delete clip",
  "matchHub.confirmDeleteClip": "Permanently delete clip \"{name}\"?",
  "matchHub.clipDeleteFailed": "The clip could not be deleted.",
  "matchHub.clipDeleted": "Clip \"{name}\" has been deleted.",
  "matchHub.deleteMatchTitle": "Delete match",
  "matchHub.confirmDeleteMatch": "Permanently delete game \"{name}\" and its linked data?",
  "matchHub.matchDeleteFailed": "The game could not be deleted.",
  "matchHub.matchDeleted": "Game \"{name}\" has been deleted.",
  "matchHub.noClipsToShare": "There are no clips yet to share with {name}.",
  "matchHub.shareIntro": "Coach {coach} shared these clips with you from the game {match}{dateSuffix}.",
  "matchHub.shareDateSuffix": " on {date}",
  "matchHub.shareTitle": "Clips from {match}",
  "matchHub.defaultCoachName": "Your coach",
  "matchHub.lineupCount": "{count} players",
  "clubTeams.heading": "Teams",
  "clubTeams.subtitle": "Prepare teams and rosters in advance and assign coaches.",
  "clubTeams.namePlaceholder": "Team name",
  "clubTeams.create": "Create team",
  "clubTeams.saveFailed": "The change could not be saved.",
  "clubTeams.coachesLabel": "Coaches: {names}",
  "clubTeams.noCoachAssigned": "no one assigned yet",
  "clubTeams.noTeamsYet": "This club has no teams yet.",
  "clubTeams.readingFile": "Reading file…",
  "clubTeams.columnsNotFound": "The First name and Last name columns were not found.",
  "clubTeams.noUsablePlayers": "No usable players found.",
  "clubTeams.importedCount": "{count} players imported. Review and save the list.",
  "clubTeams.fileReadFailed": "The file could not be read.",
  "clubTeams.rosterSaveFailed": "The roster could not be saved.",
  "clubTeams.allSaved": "Everything saved — {count} players.",
  "clubTeams.trainerCanEditRoster": "Trainer may manage roster",
  "clubTeams.trainerCanEditRosterHelp": "When this is off, an assigned trainer can view and use the players, but not edit them.",
  "clubTeams.assignCoaches": "Assign coaches",
  "clubTeams.trainerCanManageMatches": "Trainer may manage matches",
  "clubTeams.trainerCanManageMatchesHelp": "When this is off, assigned trainers can view and use matches, but cannot create, edit, or delete them.",
  "clubTeams.chooseCoaches": "Choose coaches…",
  "clubTeams.selectedCoachCount": "{count} coach(es) selected",
  "clubTeams.automaticMatches": "Automatic matches",
  "clubTeams.automaticMatchesHelp": "Prefer this team's Voetbal Vlaanderen calendar link. Foot24 remains supported as an additional source.",
  "clubTeams.calendarConfigured": "Calendar link configured — enter a value only to replace it",
  "clubTeams.testAndSync": "Test link and sync",
  "clubTeams.enableAutomaticSync": "Synchronize automatically",
  "clubTeams.syncNow": "Sync now",
  "clubTeams.lastSync": "Last: {date}",
  "clubTeams.calendarSaveFailed": "The calendar could not be saved.",
  "clubTeams.calendarSaved": "Calendar settings saved.",
  "clubTeams.calendarChecking": "Checking the calendar…",
  "clubTeams.calendarSyncFailed": "Synchronization failed.",
  "clubTeams.calendarNoChanges": "No changes.",
  "clubTeams.calendarSyncResult": "{imported} new, {updated} updated.",
  "matchHub.showAllUpcoming": "Show all upcoming matches",
  "matchHub.showFirstThree": "Show only the first 3",
  "matchPrep.open": "Prepare match",
  "matchPrep.title": "Match preparation",
  "matchPrep.general": "General information",
  "matchPrep.selection": "Selection",
  "matchPrep.field": "Pitch",
  "matchPrep.homeMatch": "Home match",
  "matchPrep.lockerRoom": "Locker room",
  "matchPrep.meetingPlace": "Meeting place",
  "matchPrep.meetingTime": "Agreed arrival time",
  "matchPrep.departureTime": "Use departure time",
  "matchPrep.other": "Other…",
  "matchPrep.enterPlace": "Enter the meeting place",
  "matchPrep.selected": "Selected",
  "matchPrep.notSelected": "Not selected",
  "matchPrep.available": "Available",
  "matchPrep.reason": "Reason not selected",
  "matchPrep.note": "Additional information",
  "matchPrep.individualAttention": "Individual focus point",
  "matchPrep.loadFailed": "Match preparation could not be loaded.",
  "matchPrep.saveFailed": "Match preparation could not be saved.",
  "clubMatchOptions.title": "Facilities and absences",
  "clubMatchOptions.subtitle": "Manage shared choices for training sessions and matches. New values become available immediately when planning.",
  "clubMatchOptions.fields": "Pitches",
  "clubMatchOptions.fieldsHelp": "Pitches available for training sessions and home matches.",
  "clubMatchOptions.lockerRooms": "Locker rooms",
  "clubMatchOptions.lockerRoomsHelp": "Locker rooms available for training sessions and home matches.",
  "clubMatchOptions.meetingPlaces": "Meeting places",
  "clubMatchOptions.meetingPlacesHelp": "Fixed meeting places, with Locker room as the default.",
  "clubMatchOptions.reasons": "Absence reasons",
  "clubMatchOptions.reasonsHelp": "Default reasons for absence from training sessions and matches. Add club-specific reasons here.",
  "clubMatchOptions.saveFailed": "The value could not be added.",
  "clubMatchOptions.removeFailed": "The value could not be removed.",
  "clubTeams.notRegisteredYet": "not registered yet",
  "clubTeams.roster": "Roster",
  "clubTeams.importHelp": "Import a ProSoccerData Excel file or edit the list manually.",
  "clubTeams.choosePsdFile": "Choose PSD file",
  "clubTeams.addPlayer": "Add player",
  "clubTeams.firstNamePlaceholder": "First name",
  "clubTeams.lastNamePlaceholder": "Last name",
  "clubTeams.phonePlaceholder": "Phone",
  "clubTeams.saveHint": "Changes to the roster are only saved once you click {save} above.",
  "clubTeams.removeDisabledTooltip": "Removal isn't supported directly here — use 'Sync' or 'Full replace' after a new import.",
  "clubTeams.importMode.merge": "Add/update",
  "clubTeams.importMode.sync": "Sync",
  "clubTeams.importMode.replace": "Full replace",
  "clubTeams.importModeHint.merge": "Existing players on this team are never removed. Contact details that conflict with another team are never silently overwritten — that goes to the club admin instead.",
  "clubTeams.importModeHint.sync": "After a new import, you choose which missing players leave the team.",
  "clubTeams.importModeHint.replace": "Any player not in the imported file leaves the team — only after explicit confirmation.",
  "clubTeams.importPreview": "{new} new · {updated} updated · {missing} not in file",
  "clubTeams.syncMissingHeading": "These players are not in the imported file. Check who may leave the team.",
  "clubTeams.replaceWarning": "These players are not in the imported file and will be removed from the team on confirmation.",
  "clubTeams.replaceConfirmLabel": "I confirm that these {count} player(s) will be fully removed from this team.",
  "clubTeams.replaceConfirmRequired": "Confirm the full replacement above first.",
  "clubTeams.allSavedWithRemoved": "Everything saved — {count} players, {removed} removed.",
  "clubTeams.addExistingHeading": "Add an existing player to this team",
  "clubTeams.addExistingHelp": "Search for a player who already belongs to another team at this club.",
  "clubTeams.addExistingSearchPlaceholder": "Search by name…",
  "clubTeams.currentlyOn": "also plays at: {teams}",
  "clubTeams.addToTeam": "Add to this team",
  "clubTeams.addedToTeam": "{name} added to this team.",
  "clubTeams.unassignedPrimaryHeading": "Choose a primary team",
  "clubTeams.unassignedPrimaryHelp": "These players play for multiple teams. Choose which team is their primary team.",
  "clubTeams.choosePrimary": "Choose {team}",
  "settings.clipProfilesHelp": "Determine how many seconds before and after the tag moment are automatically included in the clip, per tag.",
  "clipProfiles.title": "Tag timing",
  "clipProfiles.liveTags": "Live tags",
  "clipProfiles.liveTagsHelp": "Timing for tags registered live during a match.",
  "clipProfiles.videoTags": "Video tags",
  "clipProfiles.videoTagsHelp": "Timing for tags created afterwards in the Video Viewer.",
  "clipProfiles.tag": "Tag",
  "clipProfiles.startOffset": "Start vs. tag",
  "clipProfiles.endOffset": "Stop vs. tag",
  "clipProfiles.action": "Action",
  "clipProfiles.seconds": "sec",
  "clipProfiles.needTwoNumbers": "Enter two valid numbers.",
  "clipProfiles.needFourNumbers": "Enter valid start and stop times for both Live tags and Video tags.",
  "clipProfiles.startMustBeBeforeEnd": "The start value must be less than or equal to the end value.",
  "clipProfiles.savedNotice": "{name} has been saved.",
  "clipProfiles.noTagsYet": "First add quick tags in Settings.",
  "playerPage.sharedClipsMatches": "Games with shared clips",
  "playerPage.matchesPlayed": "Games played",
  "playerPage.goals": "Goals",
  "playerPage.assists": "Assists",
  "match.currentPosition": "Current position in the video",
  "common.settings": "Settings",
  "common.exit": "Sign out",
  "common.language": "Language",
  "common.dark": "Dark",
  "common.light": "Light",
  "common.back": "Back",
  "common.delete": "Delete",
  "common.working": "Working…",
  "training.title": "Training",
  "training.eyebrow": "Under construction",
  "training.body": "This will become a visual training builder where you can draw exercises on the pitch and save them for later use.",
  "home.eyebrow": "Match analysis, without the noise",
  "home.title": "Review. Tag. Coach better.",
  "home.intro": "Tag every key moment on the timeline, link plays to your players, and build a clip library your team can actually learn from.",
  "home.start": "Start reviewing",
  "home.signIn": "Sign in",
  "home.roomsEyebrow": "One studio, four rooms",
  "home.roomsTitle": "Everything a coach needs to review",
  "home.tagline": "Analyze · Coach · Improve · Win",
  "home.heroTitle": "Turn match footage into moments that matter",
  "home.register": "Register",
  "home.videoBody": "Open any match file, scrub the timeline, and drop timestamped tags on the moments you want to revisit.",
  "home.teamsBody": "Build squads, add players, and link each tag to who made the play — so clips find the right people.",
  "home.clipsBody": "Turn your tagged moments into a clip library, ready to share with the full team or a single player.",
  "home.settingsBody": "Quick tags, player order, appearance — tuned to how you like to work.",
  "home.trainingFeatureTitle": "Training",
  "home.trainingFeatureBody": "Plan sessions, draw drills on the pitch, and track player attendance.",
  "home.intradeskFeatureTitle": "Intradesk",
  "home.intradeskFeatureBody": "Save and reuse your best drills in one clear visual library.",
  "home.discover": "Explore the platform",
  "home.platformEyebrow": "From analysis to club experience",
  "home.platformTitle": "More than match video",
  "home.platformBody": "One visual platform for coaches, players, media teams and everyone around the club.",
  "home.mediaEyebrow": "Training",
  "home.mediaTitle": "From weekly plan to pitch drawing",
  "home.mediaBody": "Build a complete session, schedule it for your team, and keep everyone aligned in the same preparation.",
  "home.mediaPoint1": "Draw drills visually on the pitch",
  "home.mediaPoint2": "Plan training blocks, duration, and equipment",
  "home.mediaPoint3": "Register attendance for every player",
  "home.screensEyebrow": "Video analysis",
  "home.screensTitle": "See more in every match",
  "home.screensBody": "Review match footage, mark key moments, and give players feedback that is instantly clear.",
  "home.screensPoint1": "Tag moments directly on the timeline",
  "home.screensPoint2": "Link actions and clips to players",
  "home.screensPoint3": "Draw runs and coaching points on screen",
  "home.drawingEyebrow": "Intradesk",
  "home.drawingTitle": "Your training content always close by",
  "home.drawingBody": "Collect your own drills and club material in a visual library that is easy to search and reuse.",
  "home.drawingPoint1": "Filter by age, theme, and training goal",
  "home.drawingPoint2": "Keep favourite drills in one place",
  "home.drawingPoint3": "Add drills straight to a training session",
  "home.statisticsEyebrow": "Insights",
  "home.statisticsTitle": "Make progress visible",
  "home.statisticsBody": "Track attendance and training rhythm throughout the season without loose lists or extra calculations.",
  "home.statisticsPoint1": "Clear progress by week and period",
  "home.statisticsPoint2": "Overview by team and player",
  "home.statisticsPoint3": "Spot trends before they disappear",
  "home.ctaTitle": "Ready to make your club visually stronger?",
  "home.ctaBody": "Start with match analysis and grow towards one visual workflow for your entire club.",
  "auth.createCoach": "Create a coach account",
  "auth.createIntro": "Start reviewing footage in a couple of minutes.",
  "auth.fullName": "Full name",
  "auth.yourName": "Your name",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.passwordHint": "At least 6 characters",
  "auth.showPassword": "Show password",
  "auth.hidePassword": "Hide password",
  "auth.signUp": "Sign Up",
  "auth.creating": "Creating account…",
  "auth.alreadyAccount": "Already have an account?",
  "auth.signIn": "Sign in",
  "auth.signingIn": "Signing in…",
  "auth.noAccount": "Don't have an account?",
  "auth.createOne": "Create one",
  "auth.almostThere": "Almost there",
  "auth.checkEmail": "Check your email to confirm your account, then sign in.",
  "auth.goLogin": "Go to login",
  "auth.needHelp": "Need help?",
  "auth.realEmail": "Use a real email address — you'll need to click a confirmation link before you can sign in.",
  "auth.passwordRule": "Password must be at least 6 characters.",
  "auth.welcomeBack": "Welcome back",
  "auth.loginIntro": "Sign in to your coach account.",
  "auth.confirmationHelp": "Didn't get the confirmation email? Check your spam folder — it comes from Supabase.",
  "auth.coachSignIn": "Coach sign in",
  "auth.welcomeBackIntro": "Welcome back. Pick up where you left off.",
  "auth.yourPassword": "Your password",
  "auth.needSignInHelp": "Need help signing in?",
  "auth.adultAgreement": "I am at least 18 years old, am authorized to act for my organization, and agree to the Terms. I have read the Privacy Policy.",
  "auth.forgotPassword": "Forgot password?",
  "auth.forgotPasswordTitle": "Forgot password",
  "auth.forgotPasswordIntro": "Enter your email address and we'll send you a link to set a new password.",
  "auth.sendResetLink": "Send reset link",
  "auth.sendingResetLink": "Sending…",
  "auth.resetLinkSent": "Check your email",
  "auth.resetLinkSentIntro": "If that address belongs to an account, we've sent a reset link to it. Check your spam folder too.",
  "auth.backToLogin": "Back to sign in",
  "auth.resetPasswordTitle": "Set a new password",
  "auth.resetPasswordIntro": "Choose a new password for your account.",
  "auth.newPassword": "New password",
  "auth.confirmPassword": "Confirm password",
  "auth.passwordsDontMatch": "Passwords don't match.",
  "auth.updatePassword": "Set password",
  "auth.updatingPassword": "Working…",
  "auth.resetLinkInvalid": "This link is invalid or has expired. Request a new reset link.",
  "auth.requestNewLink": "Request a new reset link",
  "settings.appearance": "Appearance",
  "settings.appearanceHelp": "Choose how Sport Visual Systems looks on this device.",
  "settings.languageHelp": "Choose the interface language on this device.",
  "settings.quickTags": "Quick tags",
  "settings.quickTagsHelp": "These show up as one-tap buttons in the video viewer.",
  "settings.newQuickTag": "New quick tag",
  "settings.add": "Add",
  "settings.privacyTitle": "Privacy & data",
  "settings.privacyHelp": "Learn how data and images are handled or contact us with a request.",
  "settings.privacy": "Privacy Policy",
  "settings.children": "Children and images",
  "settings.contact": "Contact: info@sportvisualsystems.com",
  "settings.mailbox": "Mailbox",
  "settings.mailboxHelp": "Choose whether every new mailbox message also sends you an email notification containing the full text.",
  "settings.mailboxEmailLabel": "Receive an email notification with the message text",
  "language.label": "Choose language",
  "mailbox.title": "Mailbox",
  "mailbox.newMessage": "New email",
  "mailbox.noThreads": "Your mailbox is empty.",
  "mailbox.noThreadSelected": "Select an email thread or write a new email.",
  "mailbox.loading": "Loading...",
  "mailbox.composeTitle": "New email",
  "mailbox.subject": "Subject",
  "mailbox.subjectPlaceholder": "E.g. Training change",
  "mailbox.body": "Email text",
  "mailbox.bodyPlaceholder": "Write your email...",
  "mailbox.emailNotice": "Recipients receive the complete text as an email notification unless disabled in their settings. Replies remain centrally stored in this mailbox.",
  "mailbox.inAppOnlyNotice": "Recipients currently see this message only in the CBC Studio mailbox. Email notifications have not been enabled yet.",
  "mailbox.recipients": "Recipients",
  "mailbox.noTeams": "No teams found that you're allowed to message.",
  "mailbox.staffOf": "Staff of {team}",
  "mailbox.contactsOf": "Contacts of {team}",
  "mailbox.cancel": "Cancel",
  "mailbox.send": "Send",
  "mailbox.sending": "Sending...",
  "mailbox.missingFields": "Subject, message and at least one recipient are required.",
  "mailbox.sendFailed": "Sending failed.",
  "mailbox.replyPlaceholder": "Reply...",
  "mailbox.reply": "Reply",
  "mailbox.replyAll": "Reply all",
  "mailbox.forward": "Forward",
  "mailbox.actions": "Email actions",
  "mailbox.systemNoReply": "This is an automated message from Sports Visual Systems. Replies are not possible.",
  "mailbox.from": "From",
  "mailbox.unknownSender": "Unknown",
  "mailbox.delete": "Delete",
  "mailbox.deleteTitle": "Delete conversation?",
  "mailbox.deleteMessage": "This conversation will only disappear from your inbox. Other recipients keep their copy.",
  "mailbox.deleteFailed": "The conversation could not be deleted.",
  "mailbox.read": "Read",
  "mailbox.unread": "Not read yet",
  "mailbox.readMark": "✓",
  "share.title": "Share this clip",
  "share.anyone": "Anyone with this link can watch the clip without an account and forward the link.",
  "share.copy": "Copy",
  "share.copied": "Copied!",
  "share.phone": "Share via phone",
  "share.email": "Email",
  "share.review": "I have checked that the people in this clip may be shown for this purpose and will only share the link with the intended audience.",
  "share.secure": "Restricted share link through Sport Visual Systems",
  "share.report": "Report this image",
  "share.thisClip": "this clip",
  "share.watch": "Watch {clip} from Sport Visual Systems",
  "share.emailSubject": "A Sport Visual Systems clip for you",
  "share.emailSubjectNamed": "Sport Visual Systems clip: {name}",
  "share.clipTitle": "Sport Visual Systems clip",
  "share.close": "Close share window",
  "share.copyLink": "Copy link",
  "errors.sessionExpired": "Your session has expired. Sign in again and retry."
  ,"team.player": "Player"
  ,"team.staff": "Staff"
  ,"team.addPerson": "Add {role}"
  ,"team.firstName": "First name"
  ,"team.lastName": "Last name"
  ,"team.dateOfBirth": "Date of birth"
  ,"team.phoneNumbers": "Phone numbers"
  ,"team.phonePlaceholder": "Phone numbers, separated by commas"
  ,"team.adding": "Adding…"
  ,"team.editPlayer": "Edit player"
  ,"team.updateDetails": "Update personal and contact details."
  ,"team.team": "Team"
  ,"team.role": "Role"
  ,"team.jerseyNumber": "Jersey number"
  ,"team.position": "Position"
  ,"team.saveChanges": "Save changes"
  ,"team.couldNotSave": "Could not save: {error}"
  ,"team.create": "Create Team"
  ,"team.createIntro": "Add players manually or import a ProSoccerData Excel list."
  ,"team.name": "Team name"
  ,"team.importRoster": "Import player list"
  ,"team.importLocal": "The file is read locally for preview and is only saved after you create the team."
  ,"team.gdprConfirm": "I confirm that I have permission or another valid legal basis to use and store these players’ personal data."
  ,"team.chooseExcel": "Choose Excel file"
  ,"team.players": "Players ({count})"
  ,"team.addPlayer": "+ Add player"
  ,"team.creating": "Creating…"
  ,"team.reading": "Reading player list…"
  ,"team.noRows": "No player rows were found in this file."
  ,"team.missingColumns": "The columns ‘Voornaam’ and ‘Naam’ could not be found."
  ,"team.noUsablePlayers": "No usable players were found in this file."
  ,"team.imported": "{count} players imported. Check the list before creating the team."
  ,"team.readFailed": "The player list could not be read."
  ,"team.createFailed": "The team could not be created."
  ,"team.linkStaff": "Invite registered staff"
  ,"team.linkStaffHelp": "Enter the exact registered email address. The user only becomes staff after accepting the invitation."
  ,"team.registeredName": "Registered email address"
  ,"team.nameOrEmail": "name@example.com"
  ,"team.linking": "Inviting…"
  ,"team.link": "Send invitation"
  ,"team.linkFailed": "The invitation could not be sent."
  ,"team.invitedTo": "You have been invited to join {team} as staff."
  ,"team.acceptInvitation": "Accept"
  ,"team.declineInvitation": "Decline"
  ,"team.removePlayer": "Remove player"
  ,"team.taggedClips": "{count} tagged clip(s)"
  ,"team.none": "There are no teams visible for your account."
  ,"team.summary": "{players} players · {staff} staff"
  ,"team.delete": "Delete"
  ,"team.registeredStaff": "Registered staff"
  ,"team.addStaff": "Add staff"
  ,"team.linkRegistered": "+ Invite registered user"
  ,"team.loading": "Loading teams…"
  ,"team.playerCount": "{count} players"
  ,"team.overview": "Overview"
  ,"team.staffTab": "Staff"
  ,"team.matchesOf": "Matches for {team}"
  ,"team.trainings": "Training sessions"
  ,"team.trainingsOf": "Training sessions for {team}"
  ,"team.evaluations": "Evaluations"
  ,"team.evaluationsComingSoon": "Evaluations are coming soon."
  ,"team.tests": "Tests"
  ,"team.testsComingSoon": "This will follow later."
  ,"team.noStaff": "No staff members are linked to this team yet."
  ,"team.noMatches": "There are no matches for this team yet."
  ,"team.noTrainings": "There are no training sessions for this team yet."
  ,"team.notFound": "This team could not be found."
  ,"team.navigation": "Team navigation"
  ,"team.field": "Field"
  ,"team.lockerRoom": "Locker room"
  ,"team.openTraining": "Open training"
  ,"team.roleTrainer": "Coach"
  ,"team.roleAssistant": "Assistant coach"
  ,"team.roleManager": "Team manager / delegate"
  ,"team.roleCoordinator": "Youth coordinator"
  ,"team.roleYouthManager": "Head of youth development"
  ,"team.roleTechnicalDirector": "Technical director"
  ,"team.roleStaff": "Staff"
  ,"team.birthDate": "Date of birth"
  ,"team.phoneContact1": "Phone contact 1"
  ,"team.phoneContact2": "Phone contact 2"
  ,"team.emailContact1": "Email contact 1"
  ,"team.emailContact2": "Email contact 2"
  ,"team.goalkeeper": "Goalkeeper"
  ,"team.loadingMatches": "Loading matches…"
  ,"team.loadingTrainings": "Loading training sessions…"
  ,"team.upcomingTrainings": "Upcoming training sessions"
  ,"team.pastTrainings": "Past training sessions"
  ,"team.noUpcomingTrainings": "There are no upcoming training sessions scheduled."
  ,"team.weekOf": "Week of {start} – {end}"
  ,"team.deleteTeam": "Delete team?"
  ,"team.removeLinked": "Remove linked staff?"
  ,"team.deletePlayer": "Delete player?"
  ,"team.deleteTeamMessage": "Delete {name} and all its players and staff? This cannot be undone."
  ,"team.removeMessage": "Remove {name} from this team? This cannot be undone."
  ,"team.activePlayers": "Active players"
  ,"team.noPlayers": "No players on this team yet."
  ,"team.back": "Back to teams"
  ,"team.taggedTitle": "Tagged clips"
  ,"team.loadingClips": "Loading clips…"
  ,"team.untitledVideo": "Untitled video"
  ,"team.noTaggedClips": "No clips contain a tag for this player yet."
  ,"share.createFailed": "The share link could not be created."
  ,"video.open": "Open video"
  ,"video.formats": "MP4, MOV or M4V"
  ,"video.dialogIntro": "Use a match video from this computer or continue where you stopped."
  ,"video.useLocal": "Use video from this computer"
  ,"video.localPrivacy": "The full match stays local; only short clips you intentionally create can be uploaded."
  ,"video.previous": "Previous videos"
  ,"video.nonePrevious": "No previous videos yet."
  ,"video.untitled": "Untitled video"
  ,"video.local": "LOCAL"
  ,"video.ready": "Video ready"
  ,"video.checking": "Checking the local video…"
  ,"video.savingDetails": "Saving video details…"
  ,"video.fullNotUploaded": "The full match is not being uploaded."
  ,"video.localUnsupported": "Local clip export currently supports MP4, MOV, and M4V with H.264 or HEVC video and AAC audio."
  ,"video.localOpenFailed": "The local video could not be opened."
  ,"video.savedDrawing": "Saved coaching drawing"
  ,"video.play": "Play"
  ,"video.pause": "Pause"
  ,"video.backFive": "Back 5 seconds"
  ,"video.speed": "Playback speed"
  ,"match.edit": "Edit match"
  ,"match.teamA": "Team A"
  ,"match.teamB": "Team B"
  ,"match.date": "Date"
  ,"match.startTime": "Start time"
  ,"match.recordingStartTime": "Recording start time"
  ,"match.recordingStartTimeHelp": "When the camera started recording (not kickoff). Used to place live tags correctly."
  ,"match.videoManagement": "Video management"
  ,"match.attendance": "Attendance list"
  ,"match.noAttendancePlayers": "Select a home team first to add players."
  ,"match.replacing": "Replacing videos…"
  ,"match.replace": "Replace match videos"
  ,"match.delete": "Delete match"
  ,"match.noDate": "No date"
  ,"match.videoCount": "{count} videos"
  ,"match.periodMarkers": "Period markers"
  ,"match.reconnect": "Reconnect video {number}"
  ,"match.reconnectHelp": "Select the original files. The match and tags are already saved."
  ,"match.browserReconnect": "This browser cannot restore local files automatically. Use Chrome or Edge for persistent reconnect."
  ,"match.reconnectAll": "Reconnect all videos"
  ,"match.onlyVideo": "Only video {number}"
  ,"match.videoSequence": "Match video sequence"
  ,"match.videoNumber": "Video {number}"
  ,"match.reconnectShort": "reconnect"
  ,"match.notFound": "Match not found."
  ,"match.deleteTitle": "Delete match?"
  ,"match.deleteMessage": "Delete this match, its exclusively linked videos, tags and clips? This cannot be undone."
  ,"match.customTeam": "Custom team name"
  ,"video.playback": "Playback"
  ,"video.noVideo": "No video"
  ,"match.new": "New match"
  ,"match.older": "Older matches"
  ,"match.localIntro": "Matches and tags are saved; full videos stay local on this computer."
  ,"match.createNew": "Create new match"
  ,"match.last": "Past matches"
  ,"match.open": "Open"
  ,"match.noRecent": "No past match"
  ,"match.viewOlder": "View all past matches"
  ,"match.noneSaved": "No saved matches yet."
  ,"match.searchPlaceholder": "Search by team name..."
  ,"match.loadMore": "Load more"
  ,"match.noSearchResults": "No matches found."
  ,"match.loadFailed": "Could not load matches."
  ,"match.information": "Match information"
  ,"match.enterName": "Enter a name"
  ,"match.videos": "Match videos"
  ,"match.playOrder": "They play automatically in this order."
  ,"match.addMore": "Add more"
  ,"match.sourceFile": "Choose file"
  ,"match.sourceExternal": "External recording"
  ,"match.source360": "360 link"
  ,"match.360Link": "360 video link"
  ,"match.360LinkHelp": "Paste a secure video link. It is saved centrally with the match and is available to all authorized users."
  ,"match.360Video": "360 match video"
  ,"match.360Invalid": "Use a valid secure 360 video link (https)."
  ,"match.recordingId": "Recording number"
  ,"match.recordingIdHelp": "Enter the 360 camera recording number (e.g. 1391450) and tick which cameras filmed."
  ,"match.sourceVeo": "Veo link"
  ,"match.veoLink": "Public Veo match link"
  ,"match.veoLinkHelp": "Paste a public app.veo.co link. Clipboard Coach opens the follow-cam in the Video Viewer."
  ,"match.resolvingVeo": "Loading Veo video..."
  ,"match.veoFollowCam": "Veo follow cam"
  ,"match.veoResolveFailed": "The Veo video could not be opened."
  ,"match.camerasUsed": "Cameras used"
  ,"match.cameraLabel": "Camera {number}"
  ,"match.cameraSwitch": "Switch camera"
  ,"match.camera": "Camera"
  ,"match.attachVideos": "Add videos"
  ,"match.attachVideosHelp": "This match has no video yet. Add an external recording or a file."
  ,"match.manageSources": "Manage video sources"
  ,"match.sourceName": "Name"
  ,"match.sourceLink": "Video link"
  ,"match.cameraNumber": "Camera number (optional)"
  ,"match.cameraAlreadyAdded": "This camera is already linked"
  ,"match.camerasAlreadyAdded": "All selected cameras are already linked to this match."
  ,"match.updateSourceFailed": "The video source could not be updated."
  ,"match.editRecording": "Edit 360SI recording"
  ,"match.removeVideoConfirm": "Remove '{name}' from this match? Tags that only belong to this source will also be removed."
  ,"match.removeVideoFailed": "The video source could not be removed."
  ,"match.attachAction": "Attach"
  ,"match.back": "Back"
  ,"match.working": "Working…"
  ,"match.createAction": "Create match"
  ,"video.periodMarkers": "Period markers"
  ,"video.periodTimes": "Period times"
  ,"video.phaseTags": "Phase tags"
  ,"phaseTag.start": "Start phase"
  ,"phaseTag.stop": "Stop"
  ,"phaseTag.dialogTitle": "Name the phase"
  ,"phaseTag.namePlaceholder": "e.g. Possession"
  ,"phaseTag.save": "Save phase"
  ,"video.addClipTag": "Add clip tag"
  ,"video.draw": "Draw"
  ,"video.reconnectTitle": "Reconnect the local match video"
  ,"video.reconnectHelp": "Your tags are saved online, but the full match remains on this computer. Select the same file to continue."
  ,"video.selectOriginal": "Select original video"
  ,"video.taggedClips": "Tagged clips"
  ,"video.match": "Match"
  ,"liveTags.title": "Live tags"
  ,"liveTags.subtitle": "Moments captured during the match via the tag link."
  ,"liveTags.by": "by {name}"
  ,"liveTags.byUnknown": "by unknown tagger"
  ,"liveTags.unknownTagger": "Unknown tagger"
  ,"liveTags.taggersFilter": "Live taggers"
  ,"liveTags.filters": "Filters"
  ,"liveTags.tagTypesFilter": "Tags"
  ,"liveTags.taggersFilterHelp": "Show tags by:"
  ,"tag.tagsTitle": "Tags"
  ,"liveTags.goTo": "Go to moment"
  ,"liveTags.calibrate": "Recalibrate"
  ,"liveTags.calibrateHelp": "Play to the real moment of '{name}' and confirm."
  ,"liveTags.calibrateConfirm": "Confirm at current position"
  ,"liveTags.reviewed": "Processed"
  ,"liveTags.delete": "Delete live tag"
  ,"match.deleteNamed": "Delete {name}"
  ,"match.deleteNamedMessage": "Delete {name}, its exclusively linked videos, tags and clips? This cannot be undone."
  ,"match.autoReconnectUnavailable": "Automatic reconnect is not available in this browser. Open Clipboard Coach in Chrome or Edge and choose ‘Allow on every visit’."
  ,"match.browserCannotRemember": "This browser cannot remember local video access. You can still create the match, but you will need to reconnect the files later. Chrome or Edge can remember them."
  ,"tag.add": "+ Tag"
  ,"tag.new": "New tag"
  ,"tag.name": "Tag name"
  ,"tag.addAction": "Add tag"
  ,"tag.selectForClip": "Select {name} for clip"
  ,"tag.deleteNamed": "Delete {name}"
  ,"tag.draw": "Draw"
  ,"tag.time": "Time"
  ,"tag.start": "Start"
  ,"tag.end": "End"
  ,"tag.seconds": "sec"
  ,"tag.none": "No tags yet. Play the video and tap a tag button."
  ,"tag.bands": "Tag bands"
  ,"tag.example": "e.g. Chance"
  ,"tag.alreadyExists": "That tag already exists."
  ,"tag.periodMarker": "Period marker"
  ,"tag.editDrawingAt": "Edit drawing at {time}"
  ,"tag.drawingAt": "Drawing at {time}"
  ,"timeline.match": "Match timeline"
  ,"timeline.periodMarkers": "Period markers"
  ,"drawing.title": "Draw on frame"
  ,"drawing.minimize": "Minimize"
  ,"drawing.maximize": "Maximize"
  ,"drawing.showFor": "Show for"
  ,"drawing.seconds": "seconds"
  ,"drawing.saveFailed": "Could not save the drawing."
  ,"clip.create": "Create clip"
  ,"clip.selected": "{count} clip tag(s) selected"
  ,"clip.segmentOrder": "Clip moment order"
  ,"clip.segmentOrderHelp": "Use the arrows to choose the order of the moments in the combined clip."
  ,"clip.moveUp": "Move {name} up"
  ,"clip.moveDown": "Move {name} down"
  ,"clip.estimatedRemaining": "Estimate: ±{minutes} min left"
  ,"clip.estimateHelp": "This is an estimate based on the number of segments. Large video files and multiple cameras can take longer."
  ,"clip.renderProgress": "{completed} of {total} segments ready"
  ,"clip.chooseAudience": "Choose who can find this clip."
  ,"clip.camerasPerTag": "Cameras per tag"
  ,"clip.camerasPerTagHelp": "Every selected camera becomes a separate segment. Select only Camera 1 if you want to see each moment once."
  ,"clip.name": "Clip name"
  ,"clip.selectTeam": "Select a team"
  ,"clip.fullTeam": "Full selected team"
  ,"clip.includesPlayers": "Includes all {count} players shown below."
  ,"clip.teamPlayers": "Players in selected team ({count})"
  ,"clip.noTeamPlayers": "No players in this team yet."
  ,"clip.addPlayerName": "Add player name"
  ,"clip.making": "Making clip…"
  ,"clip.creating": "Creating…"
  ,"clip.share": "Share"
  ,"clip.previewClose": "Close"
  ,"clip.noPlayer": "No player assigned"
  ,"clip.sharedWith": "Shared with:"
  ,"clip.delete": "Delete clip"
  ,"clip.deleteTitle": "Delete clip?"
  ,"clip.deleteMessage": "Delete {name}, its share links and all uploaded video segments? This cannot be undone."
  ,"clip.deleteFailed": "The clip could not be deleted."
  ,"clip.fullSelectedTeam": "Full selected team"
  ,"clip.noPlayersSelected": "No players selected"
  ,"clip.count": "{count} clips"
  ,"clip.noneForMatch": "No clips have been created for this match yet."
  ,"clip.otherVideos": "Other videos"
  ,"clip.notLinked": "Clips not linked to a match"
  ,"clip.none": "No matches or clips yet."
  ,"clip.audience": "Audience:"
  ,"clip.segments": "{count} segments"
  ,"clip.segment": "1 segment"
  ,"clip.untitledMatch": "Untitled match"
  ,"clip.make": "Make clip"
  ,"clip.team": "Team"
  ,"clip.match": "Match"
  ,"clip.add": "Add"
  ,"clip.freeUsed": "{used}/{limit} free clips used"
  ,"clip.proPlan": "Pro plan · Unlimited clips ({count} created)"
  ,"clip.freeLimit": "You have used all 20 clips included with a free account. Upgrade to Pro to create more clips."
  ,"tag.tooLong": "This clip can be at most 3 minutes long, including drawings."
  ,"clip.reconnectAll": "Reconnect all source videos used by this match to enable clip creation."
  ,"clip.reconnectOriginal": "Reconnect the original match video before making clips."
  ,"clip.selectPerson": "Select at least one person, or choose the full team."
  ,"clip.selectFullTeam": "Select a team before choosing the full team."
  ,"clip.selectSavedTeam": "Select a saved team before adding a player."
  ,"clip.preparing": "Preparing clip…"
  ,"clip.saving": "Saving clip…"
  ,"clip.makingSegment": "Making segment {current} of {total}…"
  ,"clip.uploadingSegment": "Uploading segment {current} of {total}…"
  ,"clip.reconnectSegment": "Reconnect the source video for segment {current}."
  ,"clip.conversionFailed": "The mobile-compatible clip conversion could not be started."
  ,"clip.uploadedPreparing": "Clip uploaded. Preparing the mobile version…"
  ,"clip.processing": "Processing…"
  ,"clip.creationFailed": "Clip creation failed."
  ,"clip.keepOpen": "Keep this page open. The full match remains on this PC."
  ,"clip.play": "Play"
  ,"clip.pause": "Pause"
  ,"clip.position": "Clip position"
  ,"clip.fullscreen": "Full screen"
  ,"clip.openDirectly": "Open video directly"
  ,"clip.playFailed": "This clip could not be played by this browser."
  ,"clip.formatUnsupported": "This clip uses a video format that this browser cannot play. Try Chrome, Safari, or a newly generated mobile-compatible clip."
  ,"help.teamsTitle": "Teams & players"
  ,"help.teamsBody": "Add a team from the Teams page, then open it to add players. Each player automatically gets an avatar with their initials."
  ,"help.videoTitle": "Opening a video"
  ,"help.videoBody": "Open a local match video from the Video Viewer. The full video stays on your computer and is not uploaded to the cloud."
  ,"help.tagTitle": "Tagging"
  ,"help.tagBody": "Open a video, select who is on the field under Active players, then tap a quick tag while the video plays. Tags appear at the current time on the timeline."
  ,"help.clipTitle": "Building a clip"
  ,"help.clipBody": "Select the moments you want in the tag list, give the clip a name and audience, then choose Create clip. Only the short clip segments are uploaded."
  ,"help.shareTitle": "Sharing a clip"
  ,"help.shareBody": "Open a clip from Clips and choose Share. Anyone with the link can watch without an account, so only share it with the intended audience."
  ,"public.sharedClip": "Shared clip"
  ,"public.unavailable": "Clip not available online"
  ,"public.unavailableBody": "This link has no uploaded video. Recreate the clip while all original match videos are connected, then share the new clip."
  ,"public.madeWith": "Made with Sport Visual Systems"
  ,"public.tagline": "Review matches, tag moments and share the clips that matter."
  ,"public.start": "Start making your own clips"
  ,"admin.subtitle": "Coaches, teams and storage across all accounts"
  ,"admin.coaches": "Coaches"
  ,"admin.players": "Players"
  ,"admin.videos": "Videos"
  ,"admin.failed": "Failed"
  ,"admin.storage": "Cloud storage"
  ,"admin.viewVideos": "View all videos →"
  ,"admin.coach": "Coach"
  ,"admin.joined": "Joined"
  ,"admin.plan": "Plan"
  ,"admin.status": "Status"
  ,"admin.blocked": "Blocked"
  ,"admin.active": "Active"
  ,"admin.noneCoaches": "No coaches yet."
  ,"admin.failedCount": "({count} failed)"
  ,"admin.allVideosSubtitle": "Every match video across all coaches"
  ,"admin.backOverview": "← Back to admin overview"
  ,"admin.video": "Video"
  ,"admin.uploaded": "Uploaded"
  ,"admin.cloudSize": "Cloud size"
  ,"admin.untitled": "Untitled"
  ,"admin.localOnly": "Local only"
  ,"admin.noneVideos": "No videos yet."
  ,"admin.lastSignIn": "Last sign-in {date}"
  ,"admin.emailUnconfirmed": "Email unconfirmed"
  ,"admin.playerCount": "{count} players"
  ,"admin.noneTeams": "No teams yet."
  ,"admin.free": "Free"
  ,"admin.toFree": "Move to free plan"
  ,"admin.markPro": "Mark as Pro"
  ,"admin.unblockAccount": "Unblock account"
  ,"admin.blockAccount": "Block account"
  ,"admin.deleteAccount": "Delete account"
  ,"admin.genericError": "Something went wrong."
  ,"admin.makeClubAdmin": "Make Club Admin"
  ,"admin.removeClubAdmin": "Remove Club Admin"
  ,"admin.unblockTitle": "Unblock account?"
  ,"admin.blockTitle": "Block account?"
  ,"admin.unblockMessage": "Allow {email} to sign in again?"
  ,"admin.blockMessage": "{email} will no longer be able to sign in until the account is unblocked."
  ,"admin.unblock": "Unblock"
  ,"admin.block": "Block"
  ,"admin.deleteTitle": "Permanently delete account?"
  ,"admin.deleteMessage": "This immediately deletes {email}, including all teams, players, videos and clips. This cannot be undone."
  ,"admin.clubManagement": "Club management"
  ,"admin.clubManagementSubtitle": "View existing clubs, add a club, and assign a Club Admin or Analyst."
  ,"admin.viewClubs": "View and add clubs"
  ,"admin.noRegistrationNumber": "No registration number"
  ,"admin.trainerCount": "{count} trainer"
  ,"admin.trainerCountPlural": "{count} trainers"
  ,"admin.clubAdminCount": "{count} Club Admin"
  ,"admin.clubAdminCountPlural": "{count} Club Admins"
  ,"admin.colName": "Name"
  ,"admin.colTeams": "Team(s)"
  ,"admin.colPhone": "Phone"
  ,"admin.colEmail": "Email"
  ,"admin.notLinkedYet": "Not linked yet"
  ,"admin.noneTrainersAssigned": "No trainers assigned yet."
  ,"admin.noneClubs": "No clubs added yet."
  ,"admin.usersWithoutTeam": "Users without a team"
  ,"admin.usersWithoutTeamSubtitle": "These users have not been assigned a regular team or club team yet."
  ,"admin.assignTeam": "Assign team"
  ,"admin.everyoneHasTeam": "Every user has at least one team."
  ,"admin.colClub": "Club"
  ,"nav.home": "Home"
  ,"drawing.frameNotReady": "The current video frame is not ready yet."
  ,"drawing.arrow": "Arrow"
  ,"drawing.dottedLine": "Dotted line →"
  ,"drawing.circle": "Circle"
  ,"drawing.area": "Area"
  ,"drawing.text": "Text"
  ,"drawing.edit": "Edit"
  ,"drawing.color": "Color {color}"
  ,"drawing.chooseColor": "Choose color"
  ,"drawing.lineWidth": "Line width"
  ,"drawing.lineWidthValue": "Line width {width}"
  ,"drawing.deleteShape": "Delete shape"
  ,"drawing.deletePoint": "Delete point"
  ,"drawing.undo": "Undo"
  ,"drawing.clearAll": "Clear all"
  ,"drawing.textHint": "Draw a text box first (click twice), then enter your text."
  ,"drawing.areaHint": "Click points to draw an area. Add at least 3 points, then press Enter or Done."
  ,"drawing.pointsHint": "{count} points — click to add more or finish the area."
  ,"drawing.done": "Done (Enter)"
  ,"drawing.textPlaceholder": "Text…"
  ,"drawing.editTextHint": "Edit the text and color, or drag it to reposition."
  ,"drawing.place": "Place"
  ,"drawing.download": "Download picture"
  ,"match.drawInsideTag": "Drawing is available while the timeline is inside a tag."
  ,"tag.noLongerExists": "The selected tag no longer exists."
  ,"match.wrongOriginal": "That is not the original file for this video block."
  ,"match.checkingSaved": "Checking saved videos…"
  ,"match.selectOriginalBeforeOpen": "Select the original video files before opening the viewer."
  ,"match.localReconnectFailed": "The local videos could not be reconnected."
  ,"match.selectAllOriginals": "Select all {count} original video files before opening this match."
  ,"match.originalsMissing": "One or more original match videos are still missing. Select all match files together."
  ,"match.deleteFailed": "The match could not be deleted."
  ,"match.checkingVideo": "Checking video {number}…"
  ,"match.createFailed": "The match could not be created."
  ,"match.creating": "Creating match…"
  ,"match.savingVideo": "Saving video {current} of {total}…"
  ,"nav.account": "Account"
  ,"video.unsupportedFormat": "Unsupported video format. Choose an MP4, MOV, M4V, or WebM file."
  ,"media.unreadable": "This video container cannot be read in the browser."
  ,"media.noVideoTrack": "No video track was found in this file."
  ,"media.videoCodec": "Local clip export supports H.264 and HEVC video. This file uses {codec}."
  ,"media.audioCodec": "Local clip export requires AAC audio. This file uses {codec}."
  ,"media.durationUnknown": "The video duration could not be determined."
  ,"media.largeClipsUnsupported": "This browser cannot create large local clips. Use a recent Chrome, Edge, or Firefox version."
  ,"media.incompatibleClip": "This clip cannot be copied without conversion. Use H.264 or HEVC video with AAC audio."
  ,"media.noKeyframe": "No usable keyframe was found before this tag."
  ,"legal.privacy": "Privacy Policy"
  ,"legal.terms": "Terms of Use"
  ,"legal.children": "Children and images"
  ,"legal.report": "Report an image or privacy issue"
  ,"legal.version": "Version {version}"
  ,"terms.title": "Terms of Use"
  ,"terms.intro": "These terms apply to Sport Visual Systems, provided by Jurn Trio. Contact: info@sportvisualsystems.com."
  ,"terms.accountTitle": "1. Account and age"
  ,"terms.accountBody": "You must be at least 18 and authorised to act for yourself or your organisation. You are responsible for your account, credentials and use by anyone you give access to."
  ,"terms.videosTitle": "2. Local videos and online clips"
  ,"terms.videosBody": "Full match videos remain local. Only short clips you intentionally create, drawings and related data may be stored online. Availability and compatibility also depend on your device, browser and source format."
  ,"terms.ownershipTitle": "3. Ownership and responsibility"
  ,"terms.ownershipBody": "You retain your rights in uploaded content. You grant Clipboard Coach only the limited permission needed to provide the service. You remain responsible for the content, people shown, contact data entered, intended audience and obtaining and retaining required permissions or other legal bases."
  ,"terms.prohibitedTitle": "4. Prohibited use"
  ,"terms.prohibitedBody": "Do not use the service for unlawful, misleading, harmful or harassing content, covert monitoring or images you are not authorised to use. Do not share links more widely than necessary and respect requests from players, parents, clubs and others."
  ,"terms.liabilityTitle": "5. Availability and liability"
  ,"terms.liabilityBody": "The service is provided with reasonable care but may change, be interrupted or contain errors. Keep your own backups of important local files. To the extent permitted by law, Clipboard Coach is not liable for user decisions, loss of local source videos or unauthorised forwarding of share links."
  ,"terms.changesTitle": "6. Termination and changes"
  ,"terms.changesBody": "You can delete your account through Settings. We may restrict access for misuse, security risks or legal necessity. For material changes, we will request renewed acceptance where required."
  ,"privacyPolicy.title": "Privacy Policy"
  ,"privacyPolicy.intro": "Sport Visual Systems is operated by Jurn Trio. For privacy questions or requests, contact info@sportvisualsystems.com."
  ,"privacyPolicy.dataTitle": "1. Data we process"
  ,"privacyPolicy.dataBody": "We process account data, team and player data you enter, match metadata, tags, drawings, short clips, audience choices, share links and technically necessary security data. Full match videos stay locally on your device and are not uploaded to Clipboard Coach."
  ,"privacyPolicy.purposesTitle": "2. Purposes and legal bases"
  ,"privacyPolicy.purposesBody": "We use data to provide the service, secure accounts, process clips on request and meet legal obligations. We rely on the contract, legitimate security interests and legal obligations. The user or organisation adding data and images remains responsible for having a valid legal basis in relation to players and other people shown."
  ,"privacyPolicy.childrenTitle": "3. Images, children and contact data"
  ,"privacyPolicy.childrenBody": "Accounts are only for people aged 18 or over. Images may show minors. The uploader must inform players, opponents and others and obtain demonstrable parental or guardian consent where required. Only add contact data when authorised and after giving the person the required information."
  ,"privacyPolicy.sharingTitle": "4. Sharing and providers"
  ,"privacyPolicy.sharingBody": "Short clips and related data may be processed by hosting, database, storage and email providers needed for the service, including Supabase and Cloudflare R2 as configured. A public share link can be forwarded by recipients, so only share it with the intended audience."
  ,"privacyPolicy.retentionTitle": "5. Retention and security"
  ,"privacyPolicy.retentionBody": "We keep account content and short clips as needed for the service, with a maximum standard retention period of two years. When an account is deleted, active data and online clip files are removed; temporary backups and security logs may remain for a limited period under technical backup and security cycles."
  ,"privacyPolicy.rightsTitle": "6. Your rights"
  ,"privacyPolicy.rightsBody": "You can request access, correction, deletion, restriction, portability or object to processing. In Settings you can export data, revoke share links and delete your account. You can also contact info@sportvisualsystems.com and complain to the Belgian Data Protection Authority."
  ,"childrenPolicy.title": "Children and images"
  ,"childrenPolicy.subtitle": "Practical rules for sports images"
  ,"childrenPolicy.intro": "Clipboard Coach accounts are only for adults aged 18 or over. An adult coach or organisation may process sports footage showing children, but only with proper authority and consent where required."
  ,"childrenPolicy.beforeTitle": "Before using images"
  ,"childrenPolicy.inform": "Clearly inform players and parents or guardians about recording, analysis, clips and sharing."
  ,"childrenPolicy.rules": "Check the rules of the club, federation, venue and competition."
  ,"childrenPolicy.consent": "Keep demonstrable consent where required, including for opponents."
  ,"childrenPolicy.minimiseTitle": "Create and share as little as necessary"
  ,"childrenPolicy.minimiseBody": "Only create clips needed for coaching. Share with a limited audience, avoid sensitive information in names and revoke links when no longer needed. A recipient may forward a link or record the footage."
  ,"childrenPolicy.contactTitle": "Contact data"
  ,"childrenPolicy.contactBody": "Only add email, phone number or date of birth when genuinely needed, when authorised and after the player or parent has received the necessary privacy information."
  ,"childrenPolicy.objectionTitle": "Objection or removal"
  ,"childrenPolicy.objectionBody": "Promptly stop and review a request from a player, parent, guardian, club or other person. Revoke share links and delete clips where appropriate. Report an issue via info@sportvisualsystems.com."
  ,"consent.title": "We need your renewed acceptance"
  ,"consent.intro": "Our legal terms have been updated. Review the current versions before continuing."
  ,"consent.checkbox": "I am at least 18 years old, am authorised to act for my organisation, accept the Terms of Use and have read the Privacy Policy."
  ,"consent.submit": "Accept and continue"
  ,"consent.saving": "Saving acceptance…"
  ,"consent.required": "First confirm that you accept."
  ,"consent.failed": "Your acceptance could not be saved. Please try again."
  ,"auth.legalPrefix": "I am at least 18 years old, am authorised to act for my organisation and agree to the"
  ,"auth.legalPrivacyPrefix": "I have read the"
  ,"auth.legalRequired": "First confirm the age, authority and legal statement."
  ,"privacy.title": "Privacy and data"
  ,"privacy.retention": "Full match videos remain local. Online account content and short clips are normally retained for no more than two years."
  ,"privacy.export": "Export my data"
  ,"privacy.exportHelp": "Download a JSON file containing your account data, teams, players, match metadata, tags, clip names and metadata, share links and recorded legal acceptances. The actual MP4 clip files and local full videos are not downloaded. Nothing is deleted."
  ,"privacy.revokeLinks": "Revoke all share links"
  ,"privacy.revokeLinksHelp": "Delete every public access token. All existing links stop working for other people immediately. The clips remain available only inside your signed-in account, and you can create new share links later."
  ,"privacy.deleteAccount": "Delete account and data"
  ,"privacy.deleteAccountHelp": "Permanently delete your account, database records and online short clip and drawing files. Full local videos on your own computer are not removed."
  ,"privacy.exportFailed": "The data export could not be created."
  ,"privacy.actionFailed": "The action could not be completed."
  ,"privacy.linksRevoked": "{count} share links were revoked."
  ,"privacy.currentVersions": "Current versions — terms: {terms}; privacy: {privacy}."
  ,"privacy.accepted": "Accepted on {date} — terms: {terms}; privacy: {privacy}."
  ,"privacy.revokeTitle": "Revoke all share links?"
  ,"privacy.revokeMessage": "All active public links to your clips will stop working immediately. Your clips remain available."
  ,"privacy.revokeConfirm": "Revoke links"
  ,"privacy.deleteTitle": "Delete account and all data?"
  ,"privacy.deleteMessage": "This permanently deletes your account, teams, players, metadata, tags, drawings, short online clips and share links. This cannot be undone."
  ,"privacy.deleteConfirm": "Permanently delete everything"
  ,"common.loading": "Loading…"
  ,"onboarding.title": "Club and team"
  ,"onboarding.existingClub": "Join an existing club"
  ,"onboarding.newClub": "Register a new club"
  ,"onboarding.searchClub": "Search by club name"
  ,"onboarding.registrationNumber": "registration number"
  ,"onboarding.noClubs": "No registered clubs found."
  ,"onboarding.officialClubName": "Official club name"
  ,"onboarding.registrationOptional": "Registration number (optional)"
  ,"onboarding.similarWarning": "This club may already exist:"
  ,"onboarding.similarAcknowledge": "I checked this and still want to register a new club."
  ,"onboarding.chooseTeam": "Choose your team"
  ,"onboarding.teamMissing": "My team is not listed"
  ,"onboarding.teamName": "Team name"
  ,"onboarding.ageOptional": "Age category (optional)"
  ,"onboarding.levelOptional": "Level/competition (optional)"
  ,"onboarding.yourRole": "Your team role"
  ,"onboarding.roleCoach": "Coach"
  ,"onboarding.roleAssistant": "Assistant coach"
  ,"onboarding.roleManager": "Team manager"
  ,"onboarding.retryHint": "Your input is preserved; please retry."
  ,"onboarding.clubRequired": "Choose an existing club first."
  ,"onboarding.newRequired": "Enter the official club name and team name."
  ,"onboarding.teamRequired": "Choose a team or indicate that it is missing."
  ,"onboarding.teamNameRequired": "Enter a team name."
  ,"onboarding.similarConfirm": "Confirm that you checked the similar existing club first."
  ,"guardianInvite.contacts": "Contacts"
  ,"guardianInvite.contactNamePlaceholder": "Name (e.g. Mum)"
  ,"guardianInvite.contactPhonePlaceholder": "Mobile number"
  ,"guardianInvite.addContact": "Add another contact"
  ,"guardianInvite.generateLink": "Generate link"
  ,"guardianInvite.generating": "Working…"
  ,"guardianInvite.linkedGuardians": "Linked parents/guardians"
  ,"guardianInvite.noneLinkedYet": "No one linked yet."
  ,"guardianInvite.pendingInvites": "Pending invitations"
  ,"guardianInvite.createdOn": "Created on {date}, expires on {expiry}"
  ,"guardianInvite.copyLink": "Copy link"
  ,"guardianInvite.cancel": "Cancel"
  ,"guardianInvite.revoke": "Revoke"
  ,"guardianInvite.since": "since {date}"
  ,"guardianInvite.revokedOn": "revoked on {date}"
  ,"guardianInvite.unknownAccount": "Unknown account"
  ,"guardianInvite.modalTitle": "Invitation link"
  ,"guardianInvite.modalBody": "Send this link to the contact. Whoever signs up with it will only see the matches and clips of {name}."
  ,"guardianInvite.copied": "Copied!"
  ,"guardianInvite.copyButton": "Copy"
  ,"guardianInvite.childInfo": "Child's information"
  ,"guardianInvite.address": "Address"
  ,"guardianInvite.postalCode": "Postal code"
  ,"guardianInvite.city": "City"
  ,"guardianInvite.childPhone": "Phone (child)"
  ,"guardianInvite.childEmail": "Email (child)"
  ,"guardianInvite.noAddressYet": "No address on file yet."
  ,"guardianInvite.save": "Save"
  ,"guardianInvite.saving": "Saving…"
  ,"guardianInvite.saved": "Saved."
  ,"guardianInvite.scopeCurrentSeason": "this season"
  ,"guardianInvite.scopeFromAcceptance": "from acceptance"
  ,"guardianInvite.scopeAllHistory": "full history"
  ,"guardianInvite.addressStillCorrect": "This information is still correct"
  ,"guardianInvite.addressSectionTitle": "Child's address"
  ,"clubModule.trainingDisabled": "This club doesn't have access to the training tool."
  ,"clubModule.videoDisabled": "This club doesn't have access to the Video Viewer."
  ,"clubModule.mediaDisabled": "This club doesn't have access to Media / ClubTV."
};

export const messages: Record<Locale, Record<MessageKey, string>> = { nl, en };
export type { MessageKey };
