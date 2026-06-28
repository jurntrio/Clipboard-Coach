# Clipboard Coach Studio

Clipboard Coach Studio is a local Windows desktop app for reviewing video, saving timestamped notes, managing simple teams, and preparing a clips library. Build 1.4 improves tag interaction, timeline duration display, and the Teams layout.

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

- Single-click tag selection and double-click navigation to tag start time.
- Multi-select checkboxes for tags.
- HH:MM:SS tag start/end editing with validation.
- Add Tag popup opened by the Add Tag button or Space key.
- Timeline tag duration blocks with stacked lanes for overlapping tags.
- Vertical Teams layout with selected-team player details.
- Player first name, last name, optional email, alphabetical sorting, and prepared clip empty states.

## Build 1.3.2 Fixes

- Video Viewer left rail can select a team and active players for the current video.
- Active players can be clicked to create player tags.
- Standard tags include `Start` and `Goal`, with a simple way to add more standard tags.
- Tag editing now opens only from a tag's `Details` area using the `Edit` button.
- Tag edit panels can link active players to the tag.

## Not Included Yet

Build 1.4 intentionally does not include advanced player stats, heatmaps, distance covered, reports, cloud sync, login, AI tracking, clip export, paid APIs, or external tag import.

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
