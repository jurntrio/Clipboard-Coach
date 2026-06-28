# Clipboard Coach Studio

Clipboard Coach Studio is a local Windows desktop app for reviewing video and saving timestamped notes. Build 1 focuses only on basic video tagging.

## Build 1 Features

- Open a local video file.
- Play and pause the video.
- Add a text tag at the current timestamp.
- Show saved tags in a timestamped list.
- Save tags locally as JSON.
- Reload saved tags when the same video is opened again.

## Not Included Yet

Build 1 intentionally does not include extra players, heatmaps, reports, cloud sync, login, AI tracking, clip export, or external tag import.

## Technical Setup

- Electron for the Windows desktop shell.
- React for the app interface.
- TypeScript for application code.
- Vite for local development.
- JSON file storage in Electron's local app data folder.

## Run on Windows

Install Node.js first if it is not already installed. Then run these commands in this folder:

```powershell
npm install
npm run dev
```

The app window opens after Vite starts and Electron launches.

## Build Check

```powershell
npm run typecheck
npm run build
```
