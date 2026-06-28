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

## Build 1.3: Start Page and Navigation

- Add a desktop-style start page with Teams, Video Viewer, and Clips navigation.
- Store simple teams and player names locally in JSON.
- Let users open a new video or choose from previous locally stored video records.
- Keep the existing video viewer, timeline, tags, saving, and reloading working.
- Add selectable tags with editable start and end times.
- Give tags stable colors based on their names.
- Prepare a clips library screen without implementing real clip export.

## Build 1.3.1: Stability Fixes

- Fix Teams persistence in the current JSON app store.
- Keep teams visible immediately after create/delete actions.
- Keep player add/delete actions local and simple.
- Improve the Windows desktop shortcut with a hidden launcher wrapper.
- Keep the existing development launch command working.
- Require explicit Save before changing selected tag timing.
- Add multi-select circles for tags as preparation for later clip workflows.

## Build 1 Boundaries

Do not add advanced player stats, tag categories, periods, heatmaps, reports, cloud sync, login, AI tracking, paid APIs, real clip export, or external tag import in Build 1 through Build 1.3.

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
