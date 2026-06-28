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

## Build 1.4: Local Clip Builder and Player Links

- Add a Make Clip button in the Video Viewer.
- Create local prepared clip records from manually selected tags.
- Add quick selection by existing tag name.
- Save source video, selected tag snapshots, tag names, start/end ranges, intended audience, export status, upload status, and future sharing fields.
- Support intended audience choices for full team, selected match players, and specific players.
- Show prepared clip records and details in the Clips library.
- Allow deleting only the clip record.
- Link player-targeted clips under players in Teams.
- Show full-team clips as team links and as references under players on that team.
- Do not create real video files, upload online, or create parent/player accounts.

## Build 1.4.1: Clip Preview and Player Link Fixes

- Preview prepared clips inside the Clips library using the original source video.
- Play selected tag ranges as sequential preview segments without exporting an MP4.
- Show the currently playing segment and allow clicking a segment to jump to it.
- Show a clear warning when the source video is missing.
- Preserve player references on tags and clip segments beyond the active match-player list.
- Let tag editing link active players, selected-team players, and players already saved on the tag.
- Use automatic numbering to avoid duplicate clip names.
- Allow renaming a clip record safely from clip details.

## Build 1.4.2: Clips Library UI and Match Info

- Keep clip name and rename inputs editable while retaining unique-name numbering.
- Stop clip preview cleanly at the end and show a finished state.
- Restart preview from the first segment after it finishes.
- Show clip preview progress as elapsed clip time over total segment duration.
- Save simple match info on each video record.
- Show match info on clip cards and clip detail modals with source filename fallback.
- Use compact responsive clip cards that wrap cleanly for larger clip libraries.
- Open clip details and preview in a modal from the Clips library.

## Build 1.4.3: Clean Clips Library and Preview Modal

- Remove technical subtitle text from the Clips screen.
- Keep clip cards compact with only clip title and match title/info.
- Move delete and technical metadata into the clip detail modal.
- Reset selected clip state when opening Clips from Home.
- Add a central play overlay to the clip preview.
- Add a clip-time scrub bar that maps to the correct source segment/time.
- Add fullscreen support through the native fullscreen API.
- Keep preview-only behavior without real MP4 export.

## Build 1.4.4: Clip Context Navigation

- Open source videos from a clip at the selected clip segment start time.
- Select and expand the related source tag after the source video loads.
- Disable source-video navigation when the original file is missing.
- Open clip detail modals from Teams without navigating away from Teams.
- Keep selected team context when closing a Teams-opened clip modal.

## Build 1.4.5: Clip Modal and Source Time Fixes

- Keep Clip Builder and rename inputs fully editable while preserving safe duplicate-name numbering.
- Reuse one clip detail/preview modal from both Clips and Teams contexts.
- Keep the Teams screen, selected team, and player details in place when opening and closing a player clip modal.
- Open the source video at the current preview source time when available, otherwise the selected or first segment start.
- Keep related source tags selected/expanded after opening the source video when saved tags are available.
- Keep missing source-video actions disabled or clearly unavailable.

## Build 1.4.6: Player Clip Visibility

- Filter Teams player clip links by each clip record's intended audience before falling back to old tag player links.
- Show specific-player clips only under the saved target players.
- Show selected-match-player clips only under the selected players saved in the clip record.
- Show full-team clips in the selected team's Team Clips section instead of every player row.
- Keep clip rename/delete propagation working through the shared local clip record.
- Lightly polish Clips cards and Teams clip link buttons without changing app structure.

## Build 1.4.7: Full Team Clips and Save Workflow

- Show full-team clips under every saved player on the matching team, not only active match players.
- Keep full-team clips in the team-level Team Clips section while storing only one clip record.
- Keep specific-player and selected-player clip visibility limited to the players saved on the clip audience.
- Leave full-team clips without a known team out of individual player rows to avoid false links.
- Keep users in the Video Viewer after saving a clip record, with status feedback and optional manual navigation to the saved clip.

## Build 1.3.2: Video Tagging Usability Fixes

- Add a Video Viewer team selector and active-player selector in the left rail.
- Allow selected active players to create tags at the current video time.
- Keep `Start` and `Goal` as standard quick tags and allow more local quick tags.
- Move tag editing into each tag details area behind an explicit `Edit` button.
- Allow active players to be linked to a tag from that tag's edit panel.

## Build 1.3.3: Video Viewer UI Polish

- Keep video controls visible in the left menu.
- Move tag Details, Edit, and Delete actions into each tag row.
- Confirm before deleting a tag.
- Use popups for selecting the current match team, active match players, and quick player creation.
- Show only the most recent previous video in the left menu and use Browse for the full list.
- Show missing previous video files as disabled grey items.
- Manage saved standard tags from a popup while keeping `Start` and `Goal` protected.
- Save standard tags, active match players, tag player links, and previous video records in JSON.

## Build 1.3.4: Active Tag Indicator and Match State

- Show a compact overlay when playback is currently inside one or more tag durations.
- Hide the overlay automatically after playback passes the active tag end time.
- Keep video playback running normally when tag durations end.
- Make Edit open the tag editor directly under the clicked tag row.
- Keep Details as a separate read-only expand/collapse action.
- Make active player tag buttons visually match the standard quick tag buttons.
- Save selected match team and active match players on each video record.
- Restore saved match team and players when reopening previous videos.

## Build 1 Boundaries

Do not add advanced player stats, tag categories, periods, heatmaps, distance covered, reports, cloud sync, login, AI tracking, paid APIs, real clip export, or external tag import in Build 1 through Build 1.4.

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
