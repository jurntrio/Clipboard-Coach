# Build Plan

## Vision

Clipboard Coach Studio should help users review local videos and add timestamped coaching tags without setup friction or cloud requirements.

## Build 1: Basic Video Tagging

- Use Electron, React, and TypeScript for a simple Windows desktop app.
- Open one local video file at a time.
- Play and pause the selected video.
- Add text tags at the video's current timestamp.
- Show timestamped tags in a list.
- Save and reload tags locally with JSON storage.

## Build 1.2: Review Layout and Launcher

- Add a simple Windows launcher and Desktop shortcut helper.
- Use the current pictogram for the app window and shortcut icon.
- Make the video viewer the largest part of the interface.
- Move controls to the left, tags to the right, and timeline to the bottom.
- Add a timeline scrubber with current time, duration, and tag markers.
- Keep tag saving and reloading unchanged.

## Build 1 Boundaries

Do not add extra players, tag categories, periods, heatmaps, reports, cloud sync, login, AI tracking, clip export, or external tag import in Build 1 or Build 1.2.

## Later Builds

- Add editing and deleting tags.
- Add better review navigation and keyboard shortcuts.
- Add richer local storage when the data model needs it.
- Add reports only after the basic tagging workflow is reliable.
- Consider AI-assisted review only after local video tagging is stable.

## Open Decisions

- Packaging approach for a Windows installer.
- Future storage format, such as SQLite.
- Naming and structure for tag categories.
- Whether multiple videos can be grouped into projects later.
