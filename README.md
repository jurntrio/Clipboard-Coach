# Clipboard Coach Studio

Clipboard Coach Studio is a local Windows desktop app for reviewing video, saving timestamped notes, managing simple teams, and preparing a clips library. Build 1.4.3 cleans up clip cards and improves the clip preview modal.

## Build 1 Features

- Open a local video file.
- Play and pause the video.
- Add a text tag at the current timestamp.
- Show saved tags in a timestamped list.
- Save tags locally as JSON.
- Reload saved tags when the same video is opened again.

## Build 1.2 Features

- Larger desktop review layout with controls on the left, video in the center, tags on the right, and timeline at the bottom.
- Clickable and draggable video timeline.
- Current time and total duration display.
- Tag markers on the timeline.
- Desktop-friendly launcher files for Windows.

## Build 1.3 Features

- Start page with large navigation cards for Teams, Video Viewer, and Clips.
- Simple local teams with player names.
- Video Viewer entry point for opening a new video or reviewing previous videos.
- Previous videos list with filenames and saved tag counts.
- Selectable tags with editable start and end times.
- Stable tag colors based on tag name.
- Clips library screen prepared for future clip records.

## Build 1.3.1 Fixes

- Team creation, player creation, player deletion, and team deletion persist correctly.
- Tag time editing uses a Save button.
- Tags can be multi-selected with round selectors.
- The desktop shortcut helper now creates a hidden launcher shortcut through Windows Script Host.

## Build 1.4 Features

- Make Clip workflow in the Video Viewer for creating local prepared clip records from saved tags.
- Manual tag selection and quick selection by existing tag name.
- Intended audience choices: full team, selected match players, or specific players.
- Clip records save source video, selected tag snapshots, audience metadata, export status, upload status, and future sharing fields.
- Clips library shows real prepared clip records and details.
- Clip records can be deleted without deleting source videos, tags, teams, or players.
- Teams screen shows clip links under players and full-team clip links for the selected team.

## Build 1.4.1 Fixes

- Clips can be previewed from the original source video using saved tag start/end ranges.
- Multi-segment clips automatically jump through each selected tag segment and stop after the last one.
- Missing source videos show a clear preview unavailable warning.
- Tags and clip segments save player references so links survive active match-player changes.
- Tag editing can link players from the active match, selected team, or existing saved tag references.
- Clip names are suggested from tag/player context and duplicate names are automatically numbered.
- Clip details can rename an existing clip record without duplicating it.

## Build 1.4.2 Fixes

- Clips library uses compact responsive cards and opens clip details in a modal.
- Clip preview shows clip-time progress across all selected segments and a finished state.
- Replaying after preview end restarts from the first segment.
- Clip rename and Clip Builder name fields remain editable while keeping automatic duplicate numbering.
- Videos can store simple match info: title, home team, away team, and date.
- Clip cards and details show match info, falling back to the source filename when missing.

## Build 1.4.3 Fixes

- Clips screen cards now show only the clip title and match title/info.
- Delete and technical metadata moved into the clip detail modal.
- Home to Clips opens a clean library without reopening the last clip modal.
- Clip preview has a central play overlay, clip-time scrub bar, replay behavior, and fullscreen control.
- Technical sharing/export/upload metadata appears at the bottom of the modal.

## Build 1.3.2 Fixes

- Video Viewer left rail can select a team and active players for the current video.
- Active players can be clicked to create player tags.
- Standard tags include `Start` and `Goal`, with a simple way to add more standard tags.
- Tag editing now opens only from a tag's `Details` area using the `Edit` button.
- Tag edit panels can link active players to the tag.

## Build 1.3.3 Fixes

- Tag rows show Details, Edit, and Delete actions on the right side of each tag.
- Delete asks for confirmation before removing a tag.
- Add Team opens a confirm/cancel popup for choosing a saved team and active match players.
- Add Player opens a popup for first name, last name, and optional email.
- Previous Video shows the most recent saved video, with Browse opening the full previous-video list.
- Standard Tags opens a popup for saved quick tags while protecting `Start` and `Goal`.
- Standard tags, active match players, tag player links, and previous video records are saved in local JSON.

## Build 1.3.4 Fixes

- Video playback shows a compact active tag badge while the current time is inside one or more tag durations.
- The active tag badge disappears automatically after playback passes the tag end time.
- Edit opens the tag editor directly under that tag row without requiring Details first.
- Details still expands/collapses read-only tag information.
- Active player tag buttons use the same full-width quick-tag style as standard tags.
- Selected match team and active match players are saved with each video record and restored with previous videos.

## Not Included Yet

Build 1.4.3 intentionally does not include advanced player stats, heatmaps, distance covered, reports, cloud sync, login, AI tracking, real clip export, online sharing, parent/player accounts, paid APIs, or external tag import.

## Technical Setup

- Electron for the Windows desktop shell.
- React for the app interface.
- TypeScript for application code.
- Vite for local development.
- JSON file storage in Electron's local app data folder.
- App icon assets in `assets/`.

## Run on Windows

Install Node.js first if it is not already installed. Then run these commands in this folder:

```powershell
npm.cmd install
npm.cmd run dev
```

The app window opens after Vite starts and Electron launches.

## Beginner Launcher

You can also double-click `Launch Clipboard Coach.cmd` in this folder. It starts the app without manually typing PowerShell commands, but it may show a command window because this is still a development launcher.

To create a Desktop shortcut that avoids showing a command window:

1. Double-click `Create Desktop Shortcut.cmd`.
2. Wait for the message that the shortcut was created.
3. Use the new or replaced `Clipboard Coach` shortcut on your Desktop.

A real packaged Windows `.exe` is still the proper next step for a production launcher.

## Build Check

```powershell
npm.cmd run typecheck
npm.cmd run build
```
