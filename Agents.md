# Instructions for Codex

## General rules

- Build in small steps.
- Do not rewrite the whole app unless explicitly asked.
- Keep the app local-first.
- Prioritize stable working features over visual polish.
- After every change, explain what files changed and how to test it.
- Do not add paid APIs unless explicitly approved.
- Do not add login, cloud sync, or online accounts in early builds.
- Do not add extra features unless they are part of the current build request.

## Technical direction

Preferred direction:

- Desktop app
- Local-first
- Windows first
- Electron + React + TypeScript
- Simple local storage first
- SQLite for local storage later if needed

## First milestone

Build 1 should only include:

1. Open a local video file
2. Play/pause video
3. Add timestamped tags, that I can name myself
4. Show tags in a list
5. Save and reload tags locally
6. Clip export, with possibility to choose which tags should be in the clip

## Future features

Possible later features:

- Adding Teams
- Adding Players in Teams
- Assigning players to a match
- Periods/blocks
- Positions
- Tag categories
- Match reports
- Import external tag files from another app or browser
- Heatmaps
- Distance covered
- Player reports

## What not to do yet

Do not build these in the first version:

- Account system
- Cloud sync
- Mobile app
- Browser tagging app
- AI player tracking
- Automatic heatmaps
- Payment system
- Team sharing
