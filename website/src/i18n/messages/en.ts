import type { MessageKey } from "./nl";

export const en: Record<MessageKey, string> = {
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
  "matchHub.existingTags": "Existing tags",
  "matchHub.allExistingTagsAdded": "All existing tags have already been added.",
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
  ,"team.addFailed": "The person could not be added. Please try again."
  ,"team.cleanupFailed": "The incomplete team ‘{name}’ could not be cleaned up automatically. Remove it manually or contact an administrator."
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
  ,"match.sourceExternal": "360 number"
  ,"match.source360": "360 link"
  ,"match.360Link": "360 video link"
  ,"match.360LinkHelp": "Paste a secure video link. It is saved centrally with the match and is available to all authorized users."
  ,"match.360Video": "360 match video"
  ,"match.360Invalid": "Use a valid secure 360 video link (https)."
  ,"match.recordingId": "Recording number"
  ,"match.recordingIdHelp": "Enter the 360 camera recording number (e.g. 1391450). SVS automatically checks which cameras contain usable footage."
  ,"match.sourceVeo": "Veo link"
  ,"match.veoLink": "Public Veo match link"
  ,"match.veoLinkHelp": "Paste a public app.veo.co link. Clipboard Coach opens the follow-cam in the Video Viewer."
  ,"match.resolvingVeo": "Loading Veo video..."
  ,"match.veoFollowCam": "Veo follow cam"
  ,"match.veoResolveFailed": "The Veo video could not be opened."
  ,"match.camerasUsed": "Cameras used"
  ,"match.camerasAutoDetect": "SVS automatically checks all {count} cameras and loads only cameras with usable footage."
  ,"match.detectingCameras": "Checking cameras…"
  ,"match.noAvailableCameras": "No usable camera footage was found for this recording number."
  ,"match.cameraLabel": "Camera {number}"
  ,"match.cameraSwitch": "Switch camera"
  ,"match.camera": "Camera"
  ,"match.attachVideos": "Add videos"
  ,"match.attachVideosHelp": "This match has no video yet. Add a 360 recording number, 360 link, Veo link or file."
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
  ,"video.phaseTags": "Start/stop tag"
  ,"phaseTag.start": "Start tag"
  ,"phaseTag.stop": "Stop tag"
  ,"phaseTag.dialogTitle": "Name the phase"
  ,"phaseTag.namePlaceholder": "e.g. Possession"
  ,"phaseTag.save": "Save phase"
  ,"phaseTag.cancel": "Cancel active tag"
  ,"phaseTag.tooShort": "The tag is too short. Let the video play briefly and try again."
  ,"phaseTag.cancelledBySeek": "The active tag was cancelled because you jumped to another time."
  ,"phaseTag.saveFailed": "The tag could not be saved. Please try again."
  ,"tag.deleteFailed": "The tag could not be deleted. Please try again."
  ,"video.loadFailed": "The video data could not be loaded. Refresh the page and try again."
  ,"settings.loadFailed": "The settings could not be loaded."
  ,"settings.saveFailed": "The setting could not be saved. Please try again."
  ,"settings.deleteFailed": "The setting could not be deleted. Please try again."
  ,"settings.saved": "Saved."
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
  ,"match.browserCannotRemember": "This browser cannot remember local video access. You can still create the match, but you will need to reconnect the files later. Chrome or Edge can remember them."
  ,"tag.add": "+ Tag"
  ,"tag.new": "New tag"
  ,"tag.name": "Tag name"
  ,"tag.addAction": "Add tag"
  ,"tag.existingTags": "Standard and previously used tags"
  ,"tag.chooseExisting": "Choose an existing tag…"
  ,"tag.selectForClip": "Select {name} for clip"
  ,"tag.selectAll": "Select all tags"
  ,"tag.deselectAll": "Deselect all tags"
  ,"tag.deleteNamed": "Delete {name}"
  ,"tag.deleteConfirm": "Delete {name}?"
  ,"tag.deleteTitle": "Delete tag"
  ,"tag.deleteMessage": "Are you sure you want to delete ‘{name}’? This action cannot be undone."
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
  ,"clip.existing": "Created clips"
  ,"clip.view": "View"
  ,"clip.rename": "Rename"
  ,"clip.renameFailed": "The clip name could not be changed."
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
  ,"nav.teamsPlayers": "Teams and players"
  ,"nav.matches": "Matches"
  ,"nav.trainings": "Trainings"
  ,"nav.intradesk": "Intradesk"
  ,"nav.mediaArchive": "Media archive"
  ,"nav.scouting": "Scouting"
  ,"nav.equipment": "Equipment"
  ,"nav.media": "Media"
  ,"nav.videoViewer": "Video Viewer"
  ,"nav.mailbox": "Mailbox"
  ,"nav.clubManagement": "Club management"
  ,"nav.platformAdmin": "Platform admin"
  ,"nav.settings": "Settings"
  ,"nav.help": "Help"
  ,"nav.signOut": "Sign out"
  ,"nav.more": "More"
  ,"nav.moreLabel": "More navigation"
  ,"nav.mainLabel": "Main navigation"
  ,"page.dashboard": "Dashboard"
  ,"page.admin": "Platform admin"
  ,"page.adminBelgianClubs": "Belgian clubs"
  ,"page.adminClubMatching": "Club matching"
  ,"page.adminClubs": "Clubs"
  ,"page.adminCoach": "Coach"
  ,"page.adminVideos": "Videos"
  ,"page.clips": "Clips"
  ,"page.club": "Club management"
  ,"page.clubApprovals": "Approvals"
  ,"page.equipment": "Equipment"
  ,"page.match": "Match"
  ,"page.matchPreparation": "Match preparation"
  ,"page.help": "Help"
  ,"page.startGuide": "Start guide"
  ,"page.inbox": "Mailbox"
  ,"page.intradesk": "Intradesk"
  ,"page.training": "Training"
  ,"page.clip": "Clip"
  ,"page.mediaArchive": "Media archive"
  ,"page.media": "Media"
  ,"page.parent": "My children"
  ,"page.scouting": "Scouting"
  ,"page.settings": "Settings"
  ,"page.clipProfiles": "Clip profiles"
  ,"page.teams": "Teams and players"
  ,"page.team": "Team"
  ,"page.player": "Player"
  ,"page.staff": "Staff member"
  ,"page.trainings": "Trainings"
  ,"page.newTraining": "New training"
  ,"page.trainingStatistics": "Training statistics"
  ,"page.videos": "Video Viewer"
  ,"page.video": "Video"
  ,"page.childrenAndImages": "Children and images"
  ,"page.legalConsent": "Terms"
  ,"notFound.title": "This page doesn't exist (anymore)"
  ,"notFound.body": "The link may have expired, moved or been mistyped."
  ,"notFound.dashboard": "Go to dashboard"
  ,"confirm.title": "Are you sure?"
  ,"confirm.ok": "Confirm"
};
