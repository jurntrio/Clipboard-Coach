import {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import DrawingCanvas, { Shape } from "./DrawingCanvas";
import TrackingScreen from "./TrackingScreen";
import PlayerTrackingViewer from "./PlayerTrackingViewer";
import PlayerHeatmap, { type PitchDimensions } from "./PlayerHeatmap";
import { computeSmallSidedPitchLayout, transformToSmallSidedPitch } from "./fieldGeometry";
import type { Point2D } from "../shared/geometry";
import type { PlayerTrackRecord } from "../shared/types";
import {
  buildCalibrationHomography,
  calculateTrackDistanceMeters,
  formatDistanceKm,
  formatAverageSpeedKmh,
  getTrackFieldPoints,
  getTrackHeatmapPoints,
  HEATMAP_PITCH
} from "./trackingStats";
import homeBannerUrl from "../assets/branding/banner.png";
import homeClipsUrl from "../assets/branding/clips.png";
import appIconUrl from "../assets/branding/logo.png";
import homeSettingsUrl from "../assets/branding/settings.png";
import homeTeamsUrl from "../assets/branding/teams.png";
import homeExitUrl from "../assets/branding/exit.png";
import homeTrackingUrl from "../assets/branding/tracking.png";
import homeVideoViewerUrl from "../assets/branding/video-viewer.png";
import navHomeUrl from "../assets/branding/home.png";
import navBackUrl from "../assets/branding/back.png";

const playableExtensions = new Set([".mp4", ".m4v", ".mov", ".webm", ".ogg"]);
const tagColors = ["#68d51b", "#3aa7ff", "#ffb020", "#d66bff", "#ff6b6b", "#4dd8c8", "#f07db1"];

type Screen = "home" | "teams" | "video" | "clips" | "settings" | "tracking" | "playerTrackingViewer";
type MatchVideoSlot = VideoFile | null;
type MatchModalMode = "select" | "create" | "view" | "all";
type MatchTagItem = {
  tag: VideoTag;
  videoId: string;
  blockNumber: number;
  blockLabel: string;
  blockStartMinute: number;
  videoTime: number;
  matchTime: number;
  selectionId: string;
  sourceVideoPath: string;
};

type TimelineSliderProps = {
  min?: number;
  max: number;
  step?: number;
  value: number;
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
};

function emptyStore(): AppStore {
  return {
    teams: [],
    videos: {},
    clips: [],
    matches: [],
    settings: { standardTags: ["Start", "Goal"], activeMatchPlayerIds: [], playerNameOrder: "first_last" }
  };
}

function createVideoBlockKey(matchId: string, blockNumber: number) {
  return `match:${matchId}:block:${blockNumber}:${crypto.randomUUID()}`;
}

function getTagSelectionId(videoId: string, tagId: string) {
  return `${videoId}::${tagId}`;
}

function getMatchTags(match: StoredMatch | null, videos: Record<string, StoredVideo>, fallbackVideoId: string | null, fallbackTags: VideoTag[]) {
  if (!match) {
    return (fallbackVideoId ? fallbackTags : []).map((tag) => {
      const videoTime = tag.startTime ?? tag.time;

      return {
        tag,
        videoId: fallbackVideoId ?? "",
        blockNumber: 1,
        blockLabel: "Blok 1",
        blockStartMinute: 0,
        videoTime,
        matchTime: videoTime,
        selectionId: getTagSelectionId(fallbackVideoId ?? "", tag.id),
        sourceVideoPath: videos[fallbackVideoId ?? ""]?.path ?? fallbackVideoId ?? ""
      };
    });
  }

  return match.videoBlockIds
    .flatMap((videoId, index) => {
      const storedVideo = videos[videoId];

      if (!storedVideo) {
        return [];
      }

      const blockNumber = storedVideo.matchBlockNumber ?? index + 1;
      const blockLabel = storedVideo.matchBlockLabel ?? `Blok ${blockNumber}`;
      const blockStartMinute = storedVideo.matchBlockStartMinute ?? index * 20;

      return (storedVideo.tags ?? []).map((tag) => {
        const videoTime = tag.startTime ?? tag.time;

        return {
          tag,
          videoId,
          blockNumber,
          blockLabel,
          blockStartMinute,
          videoTime,
          matchTime: blockStartMinute * 60 + videoTime,
          selectionId: getTagSelectionId(videoId, tag.id),
          sourceVideoPath: storedVideo.path
        };
      });
    })
    .sort((first, second) => first.matchTime - second.matchTime);
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatClockTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatPreciseClockTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const wholeSeconds = Math.floor(safeSeconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${seconds.toFixed(2).padStart(5, "0")}`;
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function quantizeSliderValue(value: number, min: number, max: number, step: number) {
  if (step <= 0) {
    return clampValue(value, min, max);
  }

  const steppedValue = min + Math.round((value - min) / step) * step;
  return clampValue(Number(steppedValue.toFixed(6)), min, max);
}

function getSliderPercent(value: number, min: number, max: number) {
  if (max <= min) {
    return 0;
  }

  return ((clampValue(value, min, max) - min) / (max - min)) * 100;
}

function TimelineSlider({ min = 0, max, step = 0.01, value, disabled = false, label, onChange }: TimelineSliderProps) {
  const safeMax = Math.max(min, max);
  const percent = getSliderPercent(value, min, safeMax);
  const style = { "--slider-percent": `${percent}%` } as CSSProperties & Record<"--slider-percent", string>;

  function updateFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || safeMax <= min) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerPercent = rect.width > 0 ? clampValue((event.clientX - rect.left) / rect.width, 0, 1) : 0;
    onChange(quantizeSliderValue(min + pointerPercent * (safeMax - min), min, safeMax, step));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.buttons !== 1) {
      return;
    }

    updateFromPointer(event);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (disabled || safeMax <= min) {
      return;
    }

    const range = safeMax - min;
    const largeStep = Math.max(step, range / 10);
    const currentValue = clampValue(value, min, safeMax);
    let nextValue: number | null = null;

    if (event.key === "Home") {
      nextValue = min;
    } else if (event.key === "End") {
      nextValue = safeMax;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextValue = currentValue - step;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextValue = currentValue + step;
    } else if (event.key === "PageDown") {
      nextValue = currentValue - largeStep;
    } else if (event.key === "PageUp") {
      nextValue = currentValue + largeStep;
    }

    if (nextValue === null) {
      return;
    }

    event.preventDefault();
    onChange(quantizeSliderValue(nextValue, min, safeMax, step));
  }

  return (
    <div
      className={disabled ? "timelineSlider disabledTimelineSlider" : "timelineSlider"}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={safeMax}
      aria-valuenow={clampValue(value, min, safeMax)}
      aria-disabled={disabled}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
    >
      <div className="timelineSliderTrack">
        <div className="timelineSliderFill" />
        <div className="timelineSliderThumb" />
      </div>
    </div>
  );
}

function parseClockTime(value: string) {
  const parts = value.split(":").map((part) => Number.parseInt(part, 10));

  if (parts.some((part) => Number.isNaN(part) || part < 0)) {
    return null;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return null;
}

function shortenPath(filePath: string) {
  if (filePath.length <= 72) {
    return filePath;
  }

  return `${filePath.slice(0, 32)}...${filePath.slice(-32)}`;
}

function getVideoErrorMessage(error: MediaError | null) {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "Video loading was cancelled.";
    case MediaError.MEDIA_ERR_NETWORK:
      return "The video file could not be read from disk.";
    case MediaError.MEDIA_ERR_DECODE:
      return "The video file loaded, but this format or codec could not be decoded.";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "This video format or codec is not supported by the built-in player.";
    default:
      return "The video could not be loaded. Try a standard MP4 file encoded with H.264 video and AAC audio.";
  }
}

function getTagColor(label: string) {
  const normalized = label.trim().toLowerCase();
  let hash = 0;

  for (const character of normalized) {
    hash = (hash * 31 + character.charCodeAt(0)) % tagColors.length;
  }

  return tagColors[Math.abs(hash) % tagColors.length];
}

function normalizeTag(tag: VideoTag): VideoTag {
  const startTime = tag.startTime ?? tag.time;

  return {
    ...tag,
    startTime,
    endTime: tag.endTime ?? startTime + 5,
    color: tag.color ?? getTagColor(tag.label)
  };
}

function isTagActiveAtTime(tag: VideoTag, currentTime: number) {
  const startTime = tag.startTime ?? tag.time;
  const endTime = tag.endTime ?? startTime + 5;

  return currentTime >= startTime && currentTime < endTime;
}

function getActiveTagsAtTime(tags: VideoTag[], currentTime: number) {
  const activeNames = tags
    .map(normalizeTag)
    .filter((tag) => {
      const startTime = tag.startTime ?? tag.time;
      const endTime = tag.endTime ?? startTime + 5;
      return currentTime >= startTime && currentTime < endTime;
    })
    .map((tag) => tag.label);

  return [...new Set(activeNames)];
}

function getPlayerDisplayName(player: Player) {
  const fullName = `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim();
  return fullName || player.name || "Unnamed player";
}

function getOrderedPlayerDisplayName(player: Player, order: AppSettings["playerNameOrder"] = "first_last") {
  const firstName = player.firstName ?? "";
  const lastName = player.lastName ?? "";
  const orderedName = order === "last_first" ? `${lastName} ${firstName}`.trim() : `${firstName} ${lastName}`.trim();

  return orderedName || player.name || "Unnamed player";
}

function getPlayerReference(player: Player): PlayerReference {
  return {
    id: player.id,
    name: getPlayerDisplayName(player),
    firstName: player.firstName,
    lastName: player.lastName
  };
}

function getPlayerReferenceName(player: PlayerReference) {
  return player.name || `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim() || "Saved player";
}

function getSortedPlayers(players: Player[]) {
  return [...players].sort((first, second) => {
    const firstLast = (first.lastName || first.name || first.firstName || "").toLowerCase();
    const secondLast = (second.lastName || second.name || second.firstName || "").toLowerCase();
    const lastCompare = firstLast.localeCompare(secondLast);

    if (lastCompare !== 0) {
      return lastCompare;
    }

    return (first.firstName || "").toLowerCase().localeCompare((second.firstName || "").toLowerCase());
  });
}

function getTagLanes(tags: VideoTag[]) {
  const laneEnds: number[] = [];

  return tags.map((tag) => {
    const normalizedTag = normalizeTag(tag);
    const startTime = normalizedTag.startTime ?? normalizedTag.time;
    const endTime = Math.max(startTime + 0.25, normalizedTag.endTime ?? startTime + 5);
    let laneIndex = laneEnds.findIndex((laneEnd) => startTime >= laneEnd);

    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(endTime);
    } else {
      laneEnds[laneIndex] = endTime;
    }

    return { tag: normalizedTag, laneIndex, startTime, endTime };
  });
}

function getClipAudienceLabel(clip: ClipRecord) {
  const audience = clip.intendedAudience;

  if (!audience) {
    return "General clip";
  }

  if (audience.type === "full_team") {
    return audience.teamName ? `Full team: ${audience.teamName}` : "Full team";
  }

  if (audience.type === "selected_match_players") {
    return audience.players.length > 0
      ? `Selected match players: ${audience.players.map((player) => player.name).join(", ")}`
      : "Selected match players";
  }

  return audience.players.length > 0
    ? `Specific players: ${audience.players.map((player) => player.name).join(", ")}`
    : "Specific players";
}

function getClipTeamId(clip: ClipRecord) {
  return clip.teamId ?? clip.intendedAudience?.teamId;
}

function getClipTeamName(clip: ClipRecord) {
  return clip.teamName ?? clip.intendedAudience?.teamName;
}

function getClipTeamLabel(clip: ClipRecord) {
  return getClipTeamName(clip) ?? (getClipTeamId(clip) ? "Selected team" : "General clip");
}

function getMatchInfoTitle(matchInfo?: MatchInfo, fallback = "") {
  const explicitTitle = matchInfo?.title?.trim();

  if (explicitTitle) {
    return explicitTitle;
  }

  const teams = [matchInfo?.homeTeam, matchInfo?.awayTeam].map((value) => value?.trim()).filter(Boolean);
  const date = matchInfo?.date?.trim();
  const teamTitle = teams.length === 2 ? `${teams[0]} - ${teams[1]}` : teams[0] ?? "";

  return [teamTitle, date].filter(Boolean).join(" ") || fallback;
}

function getClipMatchTitle(clip: ClipRecord, videos: Record<string, StoredVideo>) {
  const sourceVideo = clip.sourceVideoPath ? videos[clip.sourceVideoPath] : undefined;
  return getMatchInfoTitle(sourceVideo?.matchInfo, clip.matchTitle || clip.sourceVideoName || clip.sourceVideoPath || "Source video");
}

function getClipSegmentDuration(segment: ClipTagSnapshot) {
  return Math.max(0, segment.endTime - segment.startTime);
}

function normalizePlayerName(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function playerNamesMatch(firstName: string, secondName: string) {
  const normalizedFirstName = normalizePlayerName(firstName);
  const normalizedSecondName = normalizePlayerName(secondName);

  return normalizedFirstName.length > 0 && normalizedFirstName === normalizedSecondName;
}

function audiencePlayerMatchesPlayer(audiencePlayer: MatchPlayerState, player: Player) {
  return (
    audiencePlayer.id === player.id ||
    playerNamesMatch(audiencePlayer.name, getPlayerDisplayName(player)) ||
    playerNamesMatch(audiencePlayer.name, `${player.firstName ?? ""} ${player.lastName ?? ""}`)
  );
}

function segmentLinksPlayer(segment: ClipTagSnapshot, player: Player) {
  const playerName = getPlayerDisplayName(player);

  return (
    segment.playerIds?.includes(player.id) ||
    segment.playerRefs?.some(
      (playerRef) =>
        playerRef.id === player.id ||
        playerNamesMatch(getPlayerReferenceName(playerRef), playerName) ||
        playerNamesMatch(`${playerRef.firstName ?? ""} ${playerRef.lastName ?? ""}`, playerName)
    ) ||
    false
  );
}

function clipAudienceMatchesTeam(audience: ClipAudience, team: Team) {
  return audience.teamId === team.id || (!audience.teamId && playerNamesMatch(audience.teamName ?? "", team.name));
}

function clipBelongsToTeam(clip: ClipRecord, team: Team) {
  const teamId = getClipTeamId(clip);
  const teamName = getClipTeamName(clip);

  return teamId === team.id || (!teamId && !!teamName && playerNamesMatch(teamName, team.name));
}

function isClipLinkedToPlayer(clip: ClipRecord, team: Team, player: Player) {
  if (!clipBelongsToTeam(clip, team)) {
    return false;
  }

  if (player.role === "staff") {
    return clip.shareWithStaff ?? false;
  }

  const audience = clip.intendedAudience;

  if (!audience) {
    return false;
  }

  if (audience.type === "full_team") {
    return clipAudienceMatchesTeam(audience, team);
  }

  if (audience.players.length > 0) {
    return audience.players.some((audiencePlayer) => audiencePlayerMatchesPlayer(audiencePlayer, player));
  }

  return (clip.tagSnapshots ?? []).some((tag) => segmentLinksPlayer(tag, player));
}

type PlayerMatchBlockSummary = {
  video: StoredVideo;
  blockLabel: string;
  distanceMeters: number | null;
  durationHours: number | null;
  points: Point2D[] | null;
  pitchDimensions: PitchDimensions | null;
  backgroundStyle: "image" | "simple";
};

type PlayerMatchSummary = {
  match: StoredMatch;
  clips: ClipRecord[];
  blocks: PlayerMatchBlockSummary[];
  totalDistanceMeters: number | null;
  totalDurationHours: number | null;
};

function getPlayerMatchSummaries(store: AppStore, team: Team, player: Player): PlayerMatchSummary[] {
  const summaries: PlayerMatchSummary[] = [];

  for (const match of store.matches) {
    const blocks = match.videoBlockIds
      .map((blockId) => store.videos[blockId])
      .filter((video): video is StoredVideo => !!video);

    const clips = store.clips.filter(
      (clip) =>
        isClipLinkedToPlayer(clip, team, player) &&
        clip.sourceVideoPath !== undefined &&
        store.videos[clip.sourceVideoPath]?.matchId === match.id
    );

    const trackedBlocks: PlayerMatchBlockSummary[] = blocks
      .filter((video) => video.tracking?.tracks.some((t) => t.playerId === player.id))
      .map((video) => {
        const track = video.tracking!.tracks.find((t) => t.playerId === player.id) as PlayerTrackRecord;
        const homography = buildCalibrationHomography(video);
        const videoSize =
          video.mediaInfo?.video?.width && video.mediaInfo?.video?.height
            ? { width: video.mediaInfo.video.width, height: video.mediaInfo.video.height }
            : null;
        const firstSample = track.samples[0];
        const lastSample = track.samples[track.samples.length - 1];
        const durationHours =
          track.samples.length > 1 ? (lastSample.timeSeconds - firstSample.timeSeconds) / 3600 : null;
        const pitchDimensions =
          video.calibration?.pitchLength && video.calibration?.pitchWidth
            ? { pitchLength: video.calibration.pitchLength, pitchWidth: video.calibration.pitchWidth }
            : null;
        const heatmapPoints = getTrackHeatmapPoints(track, video, videoSize);
        const rawPoints = heatmapPoints ?? getTrackFieldPoints(track, homography, videoSize);
        const heatmapPitchDimensions = heatmapPoints
          ? { pitchLength: HEATMAP_PITCH.length, pitchWidth: HEATMAP_PITCH.width }
          : null;
        // Calibration is anchored to whichever goal happened to be clicked
        // (x=0), not necessarily this team's own goal. Only an explicit
        // `false` (not undefined/legacy) means the calibrated goal is the
        // opponent's, so the whole-pitch view needs mirroring to keep "own
        // goal on the left" true - see TrackingScreen.tsx's own-goal markers.
        const points = heatmapPoints ?? (
          pitchDimensions && video.calibration?.ownGoalAtOrigin === false && rawPoints
            ? rawPoints.map((p) => ({ x: pitchDimensions.pitchLength - p.x, y: p.y }))
            : rawPoints);

        // An 8vs8 game is commonly set up ACROSS the big pitch rather than
        // along it (small goals near the big pitch's touchlines) - the
        // small pitch's own goal-to-goal axis runs along the big pitch's
        // WIDTH, not its length. Both field types calibrate against the
        // same big-pitch markings (see TrackingScreen.tsx), so the small
        // pitch's shape can be derived from the already-measured
        // pitchLength/pitchWidth with no extra calibration clicks.
        const isSmallSided = !heatmapPoints && (video.calibration?.fieldType === "8v8_groot" || video.calibration?.fieldType === "8v8_klein");
        const smallLayout = pitchDimensions && isSmallSided ? computeSmallSidedPitchLayout(pitchDimensions.pitchLength, pitchDimensions.pitchWidth) : null;
        const smallSidedPoints = smallLayout && points ? points.map((p) => transformToSmallSidedPitch(p, pitchDimensions!.pitchWidth, smallLayout)) : null;
        // transformToSmallSidedPitch maps the big pitch's positive-Y
        // touchline to smallX=0. Only an explicit `false` (not
        // undefined/legacy) means the marked small goal is actually near
        // the negative-Y touchline, so it needs mirroring to end up at
        // smallX=0 too - see the "Achterlijn klein doel" markers.
        const effectivePoints =
          smallSidedPoints && smallLayout && video.calibration?.ownSmallGoalNearPositiveY === false
            ? smallSidedPoints.map((p) => ({ x: smallLayout.pitchLength - p.x, y: p.y }))
            : smallSidedPoints ?? points;
        const effectivePitchDimensions = heatmapPitchDimensions ?? (smallLayout
          ? { pitchLength: smallLayout.pitchLength, pitchWidth: smallLayout.pitchWidth }
          : pitchDimensions);

        return {
          video,
          blockLabel: video.matchBlockLabel ?? (video.matchBlockNumber ? `Blok ${video.matchBlockNumber}` : video.name),
          distanceMeters: calculateTrackDistanceMeters(track, homography, videoSize),
          durationHours,
          points: effectivePoints,
          pitchDimensions: effectivePitchDimensions,
          backgroundStyle: smallLayout ? "simple" : "image"
        };
      });

    if (clips.length === 0 && trackedBlocks.length === 0) continue;

    // Only blocks with both a known distance and duration feed the match
    // total, so one block missing calibration doesn't skew the average
    // speed (a distance-only sum with a duration missing its matching
    // block would overstate the pace).
    const knownBlocks = trackedBlocks.filter(
      (b): b is PlayerMatchBlockSummary & { distanceMeters: number; durationHours: number } =>
        b.distanceMeters !== null && b.durationHours !== null
    );
    const totalDistanceMeters = knownBlocks.length > 0 ? knownBlocks.reduce((sum, b) => sum + b.distanceMeters, 0) : null;
    const totalDurationHours = knownBlocks.length > 0 ? knownBlocks.reduce((sum, b) => sum + b.durationHours, 0) : null;

    summaries.push({ match, clips, blocks: trackedBlocks, totalDistanceMeters, totalDurationHours });
  }

  return summaries.sort((a, b) => (b.match.date ?? "").localeCompare(a.match.date ?? ""));
}

function getUniqueName(baseName: string, existingNames: string[], ignoreName?: string) {
  const cleanBaseName = baseName.trim() || "Untitled Clip";
  const normalizedExistingNames = new Set(
    existingNames
      .filter((name) => name !== ignoreName)
      .map((name) => name.trim().toLowerCase())
  );

  if (!normalizedExistingNames.has(cleanBaseName.toLowerCase())) {
    return cleanBaseName;
  }

  let counter = 2;
  let nextName = `${cleanBaseName} ${counter}`;

  while (normalizedExistingNames.has(nextName.toLowerCase())) {
    counter += 1;
    nextName = `${cleanBaseName} ${counter}`;
  }

  return nextName;
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clipPreviewRef = useRef<HTMLVideoElement | null>(null);
  const clipPreviewFullscreenRef = useRef<HTMLDivElement | null>(null);
  const videoDragStartRef = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  const videoPanRef = useRef({ x: 0, y: 0 });
  const videoDragFrameRef = useRef<number | null>(null);
  const segmentEndHandledRef = useRef(false);
  const drawingTriggerHandledRef = useRef(false);
  const pendingDrawingIndexRef = useRef(0);
  const addTagInputRef = useRef<HTMLInputElement | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [videoZoom, setVideoZoom] = useState(1);
  const [videoZoomOrigin, setVideoZoomOrigin] = useState({ x: 50, y: 50 });
  const [videoPan, setVideoPan] = useState({ x: 0, y: 0 });
  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const [trackingViewerVideoId, setTrackingViewerVideoId] = useState<string | null>(null);
  const [store, setStore] = useState<AppStore>(emptyStore);
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [tags, setTags] = useState<VideoTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [expandedTagIds, setExpandedTagIds] = useState<string[]>([]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState({ label: "", startTime: "00:00:00", endTime: "00:00:05" });
  const [tagDraftError, setTagDraftError] = useState("");
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [isStandardTagsModalOpen, setIsStandardTagsModalOpen] = useState(false);
  const [isPreviousVideosModalOpen, setIsPreviousVideosModalOpen] = useState(false);
  const [isClipBuilderOpen, setIsClipBuilderOpen] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [pendingClipDeleteId, setPendingClipDeleteId] = useState<string | null>(null);
  const [clipDraft, setClipDraft] = useState<{
    name: string;
    selectedTagIds: string[];
    teamId: string;
    audienceType: ClipAudience["type"];
    includeStaff: boolean;
    specificPlayerIds: string[];
  }>({ name: "", selectedTagIds: [], teamId: "", audienceType: "full_team", includeStaff: false, specificPlayerIds: [] });
  const [isClipNameTouched, setIsClipNameTouched] = useState(false);
  const [clipRenameText, setClipRenameText] = useState("");
  const [isEditingClipName, setIsEditingClipName] = useState(false);
  const [clipPreviewVideo, setClipPreviewVideo] = useState<VideoFile | null>(null);
  const [clipPreviewError, setClipPreviewError] = useState("");
  const [clipPreviewSegmentIndex, setClipPreviewSegmentIndex] = useState(0);
  const [isClipPreviewPlaying, setIsClipPreviewPlaying] = useState(false);
  const [clipPreviewProgress, setClipPreviewProgress] = useState(0);
  const [isClipPreviewFinished, setIsClipPreviewFinished] = useState(false);
  const [pendingClipPreviewPlay, setPendingClipPreviewPlay] = useState(false);
  const [pendingClipPreviewStartTime, setPendingClipPreviewStartTime] = useState<number | null>(null);
  const [drawingPlayback, setDrawingPlayback] = useState<{ drawing: ClipDrawing; startedAt: number } | null>(null);
  const [drawingElapsedMs, setDrawingElapsedMs] = useState(0);
  const [exportingClipId, setExportingClipId] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState("");
  const [isSavingClipAs, setIsSavingClipAs] = useState(false);
  const [tagDrawings, setTagDrawings] = useState<
    Record<string, { id: string; baseFrameUrl: string; shapes: Shape[]; thumbnailUrl: string; videoTime: number; durationSeconds: number }[]>
  >({});
  const [editingDrawing, setEditingDrawing] = useState<{
    tagId: string;
    drawingId: string | null;
    imageUrl: string;
    initialShapes: Shape[];
    videoTime: number;
  } | null>(null);
  const [drawingCaptureError, setDrawingCaptureError] = useState("");
  const [isDrawingMaximized, setIsDrawingMaximized] = useState(false);
  const [lastSavedClipId, setLastSavedClipId] = useState<string | null>(null);
  const [pendingSourceOpen, setPendingSourceOpen] = useState<{
    videoPath: string;
    time: number;
    tagId?: string;
    shouldPlay?: boolean;
    didSeek?: boolean;
    didSelect?: boolean;
  } | null>(null);
  const [newTagText, setNewTagText] = useState("");
  const [addTagError, setAddTagError] = useState("");
  const [videoTeamId, setVideoTeamId] = useState("");
  const [activePlayerIds, setActivePlayerIds] = useState<string[]>([]);
  const [matchTeamDraftId, setMatchTeamDraftId] = useState("");
  const [matchPlayerDraftIds, setMatchPlayerDraftIds] = useState<string[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [matchModalMode, setMatchModalMode] = useState<MatchModalMode>("select");
  const [workingCopyProgress, setWorkingCopyProgress] = useState<VideoWorkingCopyProgress | null>(null);
  const [newMatchDraft, setNewMatchDraft] = useState({
    date: "",
    startTime: "",
    teamAName: "",
    teamBName: "",
    teamAId: "",
    teamBId: "",
    selectedTeamAPlayerIds: [] as string[],
    selectedTeamBPlayerIds: [] as string[],
    videoSlots: [null, null, null, null] as MatchVideoSlot[]
  });
  const [isVideoInfoOpen, setIsVideoInfoOpen] = useState(false);
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [addPlayerModalTeamId, setAddPlayerModalTeamId] = useState<string | null>(null);
  const [addPlayerDraft, setAddPlayerDraft] = useState<{ firstName: string; lastName: string; email: string; role: "player" | "staff" }>({ firstName: "", lastName: "", email: "", role: "player" });
  const [createTeamDraft, setCreateTeamDraft] = useState({
    name: "",
    players: [{ firstName: "", lastName: "", email: "" }]
  });
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [expandedTeamIds, setExpandedTeamIds] = useState<string[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<{ teamId: string; playerId: string } | null>(null);
  const [teamNameDraft, setTeamNameDraft] = useState("");
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [playerEditDraft, setPlayerEditDraft] = useState({ firstName: "", lastName: "", email: "" });
  const [isEditingMatchInfo, setIsEditingMatchInfo] = useState(false);
  const [matchEditDraft, setMatchEditDraft] = useState({
    date: "",
    startTime: "",
    teamAName: "",
    teamBName: "",
    selectedTeamAPlayerIds: [] as string[],
    selectedTeamBPlayerIds: [] as string[]
  });
  const [quickPlayerDraft, setQuickPlayerDraft] = useState({ firstName: "", lastName: "", email: "" });
  const [standardTags, setStandardTags] = useState(["Start", "Goal"]);
  const [newStandardTagText, setNewStandardTagText] = useState("");
  const [teamText, setTeamText] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [playerDraftByTeam, setPlayerDraftByTeam] = useState<
    Record<string, { firstName: string; lastName: string; email: string }>
  >({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState("Choose a section from the start page.");
  const [videoError, setVideoError] = useState("");
  const [supportWarning, setSupportWarning] = useState("");
  const [videoReady, setVideoReady] = useState(false);
  const playerNameOrder = store.settings.playerNameOrder ?? "first_last";
  const formatPlayerName = (player: Player) => getOrderedPlayerDisplayName(player, playerNameOrder);
  const appTheme = store.settings.theme ?? "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appTheme);
  }, [appTheme]);

  const sortedTags = useMemo(
    () => [...tags].map(normalizeTag).sort((first, second) => first.time - second.time),
    [tags]
  );
  const previousVideos = useMemo(
    () =>
      Object.values(store.videos).sort(
        (first, second) =>
          new Date(second.lastOpenedAt).getTime() - new Date(first.lastOpenedAt).getTime()
      ),
    [store.videos]
  );
  const latestPreviousVideo = previousVideos[0] ?? null;
  const editingTag = sortedTags.find((tag) => tag.id === editingTagId) ?? null;
  const timelineTags = useMemo(() => getTagLanes(sortedTags), [sortedTags]);
  const timelineLaneCount = Math.max(1, ...timelineTags.map((tag) => tag.laneIndex + 1));
  const activeTagNames = useMemo(() => getActiveTagsAtTime(sortedTags, currentTime), [currentTime, sortedTags]);
  const currentVideoKey = video?.storeKey ?? video?.path ?? null;
  const currentVideoRecord = currentVideoKey ? store.videos[currentVideoKey] : null;
  const kickoffVideoOffset =
    typeof currentVideoRecord?.kickoffVideoOffset === "number" ? currentVideoRecord.kickoffVideoOffset : null;
  const blockEndVideoOffset =
    typeof currentVideoRecord?.blockEndVideoOffset === "number" ? currentVideoRecord.blockEndVideoOffset : null;
  const matchClock = kickoffVideoOffset === null ? null : Math.max(0, currentTime - kickoffVideoOffset);
  const selectedMatchId = activeMatchId ?? currentVideoRecord?.matchId ?? null;
  const activeMatch = selectedMatchId ? store.matches.find((match) => match.id === selectedMatchId) ?? null : null;
  const activeMatchVideos = activeMatch
    ? activeMatch.videoBlockIds.map((videoKey) => store.videos[videoKey]).filter((storedVideo): storedVideo is StoredVideo => !!storedVideo)
    : [];
  const activeMatchVideoBlocks = activeMatch
    ? activeMatch.videoBlockIds
        .map((videoKey) => ({ videoKey, storedVideo: store.videos[videoKey] }))
        .filter((block): block is { videoKey: string; storedVideo: StoredVideo } => !!block.storedVideo)
    : [];
  const matchTimelineTotalMinutes = activeMatchVideos.length
    ? Math.max(
        ...activeMatchVideos.map((storedVideo, index) => storedVideo.matchBlockStartMinute ?? index * 20)
      ) + 20
    : 0;
  const recentMatches = useMemo(
    () =>
      [...store.matches]
        .filter((match) => match.lastOpenedAt)
        .sort((first, second) => new Date(second.lastOpenedAt ?? "").getTime() - new Date(first.lastOpenedAt ?? "").getTime())
        .slice(0, 3),
    [store.matches]
  );
  const selectedTeamA = newMatchDraft.teamAId
    ? store.teams.find((team) => team.id === newMatchDraft.teamAId) ?? null
    : null;
  const selectedTeamB = newMatchDraft.teamBId
    ? store.teams.find((team) => team.id === newMatchDraft.teamBId) ?? null
    : null;
  const availablePlayers = useMemo(() => {
    const playersById = new Map<string, Player>();

    for (const team of store.teams) {
      for (const player of team.players) {
        playersById.set(player.id, player);
      }
    }

    return getSortedPlayers([...playersById.values()]);
  }, [store.teams]);
  const selectedClip = store.clips.find((clip) => clip.id === selectedClipId) ?? null;
  const selectedClipSegments = useMemo(() => {
    if (!selectedClip) {
      return [];
    }

    const snapshots = selectedClip.tagSnapshots ?? [];

    const mergeDrawings = (segment: ClipTagSnapshot): ClipTagSnapshot => {
      const hasLiveDrawings = Object.prototype.hasOwnProperty.call(tagDrawings, segment.id);
      const liveDrawings = tagDrawings[segment.id];

      if (hasLiveDrawings) {
        return {
          ...segment,
          drawings: (liveDrawings ?? [])
            .map((d) => ({ id: d.id, dataUrl: d.thumbnailUrl, durationSeconds: d.durationSeconds, videoTime: d.videoTime }))
            .sort((a, b) => a.videoTime - b.videoTime)
        };
      }

      const sourceVideoId = segment.sourceVideoId;
      if (sourceVideoId) {
        const storedTag = store.videos[sourceVideoId]?.tags.find((t) => t.id === segment.id);

        if (storedTag?.drawings) {
          return {
            ...segment,
            drawings: storedTag.drawings
              .map((d) => ({ id: d.id, dataUrl: d.thumbnailUrl, durationSeconds: d.durationSeconds, videoTime: d.videoTime }))
              .sort((a, b) => a.videoTime - b.videoTime)
          };
        }
      }

      return segment;
    };

    if (snapshots.length > 0) {
      return [...snapshots]
        .sort((first, second) => {
          const firstMatchTime = (first.blockStartMinute ?? ((first.blockNumber ?? 1) - 1) * 20) * 60 + first.startTime;
          const secondMatchTime = (second.blockStartMinute ?? ((second.blockNumber ?? 1) - 1) * 20) * 60 + second.startTime;

          return firstMatchTime - secondMatchTime;
        })
        .map(mergeDrawings);
    }

    if (typeof selectedClip.startTime === "number" && typeof selectedClip.endTime === "number") {
      return [
        mergeDrawings({
          id: selectedClip.id,
          label: selectedClip.tagNames?.join(", ") || selectedClip.name,
          startTime: selectedClip.startTime,
          endTime: selectedClip.endTime,
          playerIds: [],
          playerRefs: []
        })
      ];
    }

    return [];
  }, [selectedClip, tagDrawings, store.videos]);
  const currentClipSegment = selectedClipSegments[clipPreviewSegmentIndex] ?? null;
  const selectedClipDuration = useMemo(
    () => selectedClipSegments.reduce((total, segment) => total + getClipSegmentDuration(segment), 0),
    [selectedClipSegments]
  );
  const currentSegmentOffset = useMemo(
    () =>
      selectedClipSegments
        .slice(0, clipPreviewSegmentIndex)
        .reduce((total, segment) => total + getClipSegmentDuration(segment), 0),
    [clipPreviewSegmentIndex, selectedClipSegments]
  );
  const visibleTagItems = useMemo(
    () => getMatchTags(activeMatch, store.videos, currentVideoKey, sortedTags),
    [activeMatch, currentVideoKey, sortedTags, store.videos]
  );
  const currentVideoTagNames = useMemo(
    () => [...new Set(visibleTagItems.map((item) => item.tag.label))],
    [visibleTagItems]
  );
  const selectedTeam = store.teams.find((team) => team.id === selectedTeamId) ?? store.teams[0] ?? null;
  const videoTeam = store.teams.find((team) => team.id === videoTeamId) ?? null;
  const videoTeamPlayers = useMemo(() => getSortedPlayers(videoTeam?.players ?? []), [videoTeam]);
  const matchDraftTeam = store.teams.find((team) => team.id === matchTeamDraftId) ?? null;
  const matchDraftPlayers = useMemo(() => getSortedPlayers(matchDraftTeam?.players ?? []), [matchDraftTeam]);
  const selectedTeamAPlayers = useMemo(
    () => getSortedPlayers((activeMatch?.selectedTeamAPlayerIds ?? []).map((playerId) => getPlayerById(playerId)).filter((player): player is Player => !!player)),
    [activeMatch?.selectedTeamAPlayerIds, store.teams]
  );
  const selectedTeamBPlayers = useMemo(
    () => getSortedPlayers((activeMatch?.selectedTeamBPlayerIds ?? []).map((playerId) => getPlayerById(playerId)).filter((player): player is Player => !!player)),
    [activeMatch?.selectedTeamBPlayerIds, store.teams]
  );
  const activePlayers = useMemo(
    () => {
      const matchPlayers = [...selectedTeamAPlayers, ...selectedTeamBPlayers];

      if (matchPlayers.length > 0) {
        return matchPlayers;
      }

      return activePlayerIds
        .map((playerId) => {
          const teamPlayer = videoTeamPlayers.find((player) => player.id === playerId);
          const savedPlayer = currentVideoRecord?.matchState?.players.find((player) => player.id === playerId);

          if (teamPlayer) {
            return teamPlayer;
          }

          if (savedPlayer) {
            return {
              id: savedPlayer.id,
              name: savedPlayer.name,
              firstName: savedPlayer.name,
              lastName: "",
              createdAt: ""
            };
          }

          return null;
        })
        .filter((player): player is Player => player !== null);
    },
    [activePlayerIds, currentVideoRecord?.matchState?.players, selectedTeamAPlayers, selectedTeamBPlayers, videoTeamPlayers]
  );
  const clipDraftTeam = clipDraft.teamId ? store.teams.find((team) => team.id === clipDraft.teamId) ?? null : null;
  const clipDraftPlayers = useMemo(
    () => getSortedPlayers((clipDraftTeam?.players ?? []).filter((player) => player.role !== "staff")),
    [clipDraftTeam]
  );
  const clipDraftMatchPlayers = useMemo(() => {
    if (!clipDraftTeam || !activeMatch) {
      return [];
    }

    const matchPlayerIds =
      activeMatch.teamAId === clipDraftTeam.id
        ? activeMatch.selectedTeamAPlayerIds
        : activeMatch.teamBId === clipDraftTeam.id
          ? activeMatch.selectedTeamBPlayerIds
          : [];

    return getSortedPlayers(
      matchPlayerIds
        .map((playerId) => clipDraftTeam.players.find((player) => player.id === playerId))
        .filter((player): player is Player => !!player && player.role !== "staff")
    );
  }, [activeMatch, clipDraftTeam]);
  const hasClipDraftTeam = !!clipDraftTeam;
  const canUseSelectedMatchPlayers = hasClipDraftTeam && clipDraftMatchPlayers.length > 0;

  useEffect(() => {
    window.clipboardCoach.loadStore().then((loadedStore) => {
      setStore(loadedStore);
      setStandardTags(loadedStore.settings.standardTags.length ? loadedStore.settings.standardTags : ["Start", "Goal"]);
      const rememberedTeamId = loadedStore.settings.lastSelectedTeamId;
      setSelectedTeamId(
        rememberedTeamId && loadedStore.teams.some((team) => team.id === rememberedTeamId)
          ? rememberedTeamId
          : loadedStore.teams[0]?.id ?? null
      );
      setVideoTeamId("");
      setActivePlayerIds([]);
    });
  }, []);

  useEffect(() => {
    return window.clipboardCoach.onVideoWorkingCopyProgress((progress) => {
      setWorkingCopyProgress(progress);
      setStatus(
        progress.stage === "ready"
          ? "Compatible working copy ready."
          : `Creating compatible working copy... ${Math.round(progress.progress * 100)}%`
      );
    });
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, video]);

  useEffect(() => {
    if (!editingTag) {
      setTagDraft({ label: "", startTime: "00:00:00", endTime: "00:00:05" });
      setTagDraftError("");
      return;
    }

    setTagDraft({
      label: editingTag.label,
      startTime: formatClockTime(editingTag.startTime ?? editingTag.time),
      endTime: formatClockTime(editingTag.endTime ?? (editingTag.startTime ?? editingTag.time) + 5)
    });
    setTagDraftError("");
  }, [editingTag?.id]);

  useEffect(() => {
    setClipRenameText(selectedClip?.name ?? "");
    setIsEditingClipName(false);
    setClipPreviewSegmentIndex(0);
    setIsClipPreviewPlaying(false);
    setPendingClipPreviewPlay(false);
    setExportError("");
    setClipPreviewVideo(null);
    setClipPreviewError("");
    setClipPreviewProgress(0);
    setIsClipPreviewFinished(false);
    setDrawingPlayback(null);
    setDrawingElapsedMs(0);
    segmentEndHandledRef.current = false;
    drawingTriggerHandledRef.current = false;
    pendingDrawingIndexRef.current = 0;

    const firstSourcePath = selectedClipSegments[0]?.sourceVideoPath ?? selectedClip?.sourceVideoPath;

    if (!firstSourcePath) {
      return;
    }

    window.clipboardCoach
      .openVideoFromPath(firstSourcePath)
      .then((sourceVideo) => {
        setClipPreviewVideo(sourceVideo);
        setClipPreviewError("");
      })
      .catch((error) => {
        console.error("Clip source video missing:", firstSourcePath, error);
        setClipPreviewError("Source video missing - preview unavailable.");
      });
  }, [selectedClip?.id]);

  useEffect(() => {
    const player = clipPreviewRef.current;
    const firstSegment = selectedClipSegments[0];

    if (!player || !firstSegment) {
      return;
    }

    player.currentTime = firstSegment.startTime;
    setClipPreviewProgress(0);
  }, [clipPreviewVideo?.url, selectedClipSegments]);

  useEffect(() => {
    if (!drawingPlayback) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - drawingPlayback.startedAt;
      setDrawingElapsedMs(elapsed);

      if (elapsed >= drawingPlayback.drawing.durationSeconds * 1000) {
        setDrawingPlayback(null);
        setDrawingElapsedMs(0);
        drawingTriggerHandledRef.current = false;

        const player = clipPreviewRef.current;

        if (player) {
          player
            .play()
            .then(() => setIsClipPreviewPlaying(true))
            .catch((error) => {
              console.error("Clip preview playback failed:", error);
              setClipPreviewError("Clip preview could not start.");
              setIsClipPreviewPlaying(false);
            });
        }
      }
    }, 80);

    return () => clearInterval(interval);
  }, [drawingPlayback]);

  useEffect(() => {
    if (selectedTeamId && store.teams.some((team) => team.id === selectedTeamId)) {
      return;
    }

    setSelectedTeamId(store.teams[0]?.id ?? null);
  }, [selectedTeamId, store.teams]);

  useEffect(() => {
    if (!videoTeamId || store.teams.some((team) => team.id === videoTeamId)) {
      return;
    }

    setVideoTeamId("");
  }, [videoTeamId, store.teams]);

  useEffect(() => {
    setClipDraft((current) => {
      const draftTeam = current.teamId ? store.teams.find((team) => team.id === current.teamId) ?? null : null;
      const validPlayerIds = new Set((draftTeam?.players ?? []).filter((player) => player.role !== "staff").map((player) => player.id));
      const nextSpecificPlayerIds = current.specificPlayerIds.filter((playerId) => validPlayerIds.has(playerId));

      if (!draftTeam) {
        if (!current.teamId && current.audienceType === "full_team" && !current.includeStaff && current.specificPlayerIds.length === 0) {
          return current;
        }

        return {
          ...current,
          teamId: "",
          audienceType: "full_team",
          includeStaff: false,
          specificPlayerIds: []
        };
      }

      const nextAudienceType =
        current.audienceType === "selected_match_players" && clipDraftMatchPlayers.length === 0
          ? "full_team"
          : current.audienceType;

      if (nextAudienceType === current.audienceType && nextSpecificPlayerIds.length === current.specificPlayerIds.length) {
        return current;
      }

      return {
        ...current,
        audienceType: nextAudienceType,
        specificPlayerIds: nextSpecificPlayerIds
      };
    });
  }, [clipDraftMatchPlayers.length, store.teams]);

  useEffect(() => {
    const savedPlayerIds = currentVideoRecord?.matchState?.players.map((player) => player.id) ?? [];
    setActivePlayerIds((current) =>
      current.filter(
        (playerId) => videoTeamPlayers.some((player) => player.id === playerId) || savedPlayerIds.includes(playerId)
      )
    );
  }, [currentVideoRecord?.matchState?.players, videoTeamPlayers]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (event.code !== "Space" || isTyping || screen !== "video" || !video) {
        return;
      }

      event.preventDefault();
      openAddTagModal();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen, video, currentTime]);

  useEffect(() => {
    if (!isAddTagOpen) {
      return;
    }

    window.setTimeout(() => {
      addTagInputRef.current?.focus();
      addTagInputRef.current?.select();
    }, 0);
  }, [isAddTagOpen]);

  useEffect(() => {
    if (!video || !currentVideoKey) {
      return;
    }

    window.clipboardCoach.loadTags(currentVideoKey).then(async (savedTags) => {
      const normalizedTags = savedTags.map(normalizeTag);
      setTags(normalizedTags);

      const loadedDrawings: Record<string, { id: string; baseFrameUrl: string; shapes: Shape[]; thumbnailUrl: string; videoTime: number; durationSeconds: number }[]> = {};
      for (const tag of normalizedTags) {
        if (tag.drawings && tag.drawings.length > 0) {
          loadedDrawings[tag.id] = tag.drawings.map((d) => ({
            id: d.id,
            baseFrameUrl: d.baseFrameUrl,
            shapes: d.shapes as Shape[],
            thumbnailUrl: d.thumbnailUrl,
            videoTime: d.videoTime,
            durationSeconds: d.durationSeconds
          }));
        }
      }
      setTagDrawings(loadedDrawings);
      const pendingTag = pendingSourceOpen?.videoPath === currentVideoKey
        ? normalizedTags.find((tag) => tag.id === pendingSourceOpen.tagId) ??
          normalizedTags.find((tag) => {
            const startTime = tag.startTime ?? tag.time;
            const endTime = tag.endTime ?? startTime + 5;
            return pendingSourceOpen.time >= startTime && pendingSourceOpen.time <= endTime;
          })
        : null;
      setSelectedTagIds(
        pendingTag
          ? [pendingTag.id, getTagSelectionId(currentVideoKey, pendingTag.id)]
          : normalizedTags[0]
            ? [normalizedTags[0].id, getTagSelectionId(currentVideoKey, normalizedTags[0].id)]
            : []
      );
      setExpandedTagIds(pendingTag ? [pendingTag.id] : []);
      if (pendingSourceOpen?.videoPath === currentVideoKey) {
        setPendingSourceOpen((current) =>
          current?.videoPath === currentVideoKey ? { ...current, didSelect: true } : current
        );
      }
      setStatus(normalizedTags.length > 0 ? "Saved tags loaded for this video." : "No saved tags yet.");
      const nextStore = await refreshStore();
      restoreVideoMatchState(currentVideoKey, nextStore);
    });
  }, [video, currentVideoKey]);

  useEffect(() => {
    if (pendingSourceOpen?.didSeek && pendingSourceOpen.didSelect) {
      setPendingSourceOpen(null);
    }
  }, [pendingSourceOpen]);

  useEffect(() => {
    if (!pendingSourceOpen || pendingSourceOpen.didSeek || !video || currentVideoKey !== pendingSourceOpen.videoPath) {
      return;
    }

    const player = videoRef.current;

    if (!player || player.readyState === 0) {
      return;
    }

    const targetTime = Math.min(
      Math.max(pendingSourceOpen.time, 0),
      Number.isFinite(player.duration) && player.duration > 0 ? player.duration : pendingSourceOpen.time
    );

    player.currentTime = targetTime;
    setCurrentTime(targetTime);
    setPendingSourceOpen((current) => (current?.videoPath === currentVideoKey ? { ...current, didSeek: true } : current));

    if (pendingSourceOpen.shouldPlay) {
      player
        .play()
        .then(() => setIsPlaying(true))
        .catch((error) => {
          console.error("Source video playback could not resume:", error);
          setIsPlaying(false);
        });
    }
  }, [pendingSourceOpen, video]);

  async function refreshStore() {
    const nextStore = await window.clipboardCoach.loadStore();
    setStore(nextStore);
    return nextStore;
  }

  async function persistStore(nextStore: AppStore) {
    const savedStore = await window.clipboardCoach.saveStore(nextStore);
    setStore(savedStore);
  }

  async function persistSettings(nextSettings: Partial<AppSettings>) {
    const nextStore = {
      ...store,
      settings: {
        ...store.settings,
        ...nextSettings
      }
    };

    setStore(nextStore);
    await persistStore(nextStore);
  }

  function selectTeam(teamId: string) {
    if (!store.teams.some((team) => team.id === teamId)) {
      return;
    }

    setSelectedTeamId(teamId);
    void persistSettings({ lastSelectedTeamId: teamId });
  }

  function buildMatchState(teamId: string, playerIds: string[], sourceStore = store): MatchState | undefined {
    if (!teamId && playerIds.length === 0) {
      return undefined;
    }

    const team = sourceStore.teams.find((storedTeam) => storedTeam.id === teamId);
    const players = playerIds.map((playerId) => {
      const player = team?.players.find((storedPlayer) => storedPlayer.id === playerId);
      const savedPlayer = currentVideoRecord?.matchState?.players.find((storedPlayer) => storedPlayer.id === playerId);

      return {
        id: playerId,
        name: player ? getPlayerDisplayName(player) : savedPlayer?.name ?? "Saved player"
      };
    });

    return {
      teamId: teamId || undefined,
      teamName: team?.name ?? currentVideoRecord?.matchState?.teamName,
      players
    };
  }

  async function persistVideoMatchState(teamId: string, playerIds: string[], sourceStore = store) {
    if (!video || !currentVideoKey) {
      return;
    }

    const existingVideo = sourceStore.videos[currentVideoKey] ?? {
      path: video.path,
      name: video.name,
      extension: video.extension,
      lastOpenedAt: new Date().toISOString(),
      tags
    };
    const nextStore = {
      ...sourceStore,
      videos: {
        ...sourceStore.videos,
        [currentVideoKey]: {
          ...existingVideo,
          matchState: buildMatchState(teamId, playerIds, sourceStore)
        }
      }
    };

    setStore(nextStore);
    await persistStore(nextStore);
  }

  function restoreVideoMatchState(videoPath: string, sourceStore: AppStore) {
    const videoRecord = sourceStore.videos[videoPath];
    const matchState = videoRecord?.matchState;
    const matchTeamId =
      matchState?.teamId ??
      (videoRecord?.matchId
        ? sourceStore.matches.find((m) => m.id === videoRecord.matchId)?.teamAId ?? ""
        : "");

    setVideoTeamId(matchTeamId);
    setActivePlayerIds(matchState?.players.map((player) => player.id) ?? []);
  }

  async function persistVideoMatchInfo(nextMatchInfo: MatchInfo) {
    if (!video || !currentVideoKey) {
      return;
    }

    const existingVideo = store.videos[currentVideoKey] ?? {
      path: video.path,
      name: video.name,
      extension: video.extension,
      lastOpenedAt: new Date().toISOString(),
      tags
    };
    const nextStore = {
      ...store,
      videos: {
        ...store.videos,
        [currentVideoKey]: {
          ...existingVideo,
          matchInfo: nextMatchInfo
        }
      }
    };

    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function markBlockBoundary(boundary: "start" | "end") {
    if (!video || !currentVideoKey) {
      return;
    }

    const boundaryTime = videoRef.current?.currentTime ?? currentTime;
    const existingVideo = store.videos[currentVideoKey] ?? {
      path: video.path,
      name: video.name,
      extension: video.extension,
      lastOpenedAt: new Date().toISOString(),
      tags
    };
    const nextStore = {
      ...store,
      videos: {
        ...store.videos,
        [currentVideoKey]: {
          ...existingVideo,
          ...(boundary === "start"
            ? { kickoffVideoOffset: boundaryTime }
            : { blockEndVideoOffset: boundaryTime })
        }
      }
    };

    setStore(nextStore);
    setStatus(
      `${boundary === "start" ? "Start blok" : "Einde blok"} gemarkeerd op ${formatClockTime(boundaryTime)}.`
    );
    await persistStore(nextStore);
  }

  function updateCurrentMatchInfo(field: keyof MatchInfo, value: string) {
    const nextMatchInfo = {
      ...(currentVideoRecord?.matchInfo ?? {}),
      [field]: value
    };

    void persistVideoMatchInfo(nextMatchInfo);
  }

  function resetNewMatchDraft() {
    setNewMatchDraft({
      date: "",
      startTime: "",
      teamAName: "",
      teamBName: "",
      teamAId: "",
      teamBId: "",
      selectedTeamAPlayerIds: [],
      selectedTeamBPlayerIds: [],
      videoSlots: [null, null, null, null]
    });
  }

  function getMatchTeamName(teamId: string, fallbackName: string) {
    return store.teams.find((team) => team.id === teamId)?.name ?? fallbackName.trim();
  }

  function getMatchPlayerNames(playerIds: string[]) {
    return playerIds.map((playerId) => getPlayerById(playerId)).filter((player): player is Player => !!player).map(formatPlayerName);
  }

  function openMatchInfoModal() {
    if (activeMatch) {
      setMatchEditDraft({
        date: activeMatch.date,
        startTime: activeMatch.startTime ?? "",
        teamAName: activeMatch.teamAName,
        teamBName: activeMatch.teamBName,
        selectedTeamAPlayerIds: activeMatch.selectedTeamAPlayerIds,
        selectedTeamBPlayerIds: activeMatch.selectedTeamBPlayerIds
      });
      setIsEditingMatchInfo(false);
      setMatchModalMode("view");
    } else {
      setMatchModalMode("select");
    }

    setIsMatchModalOpen(true);
  }

  function toggleNewMatchPlayer(teamSide: "A" | "B", playerId: string) {
    const field = teamSide === "A" ? "selectedTeamAPlayerIds" : "selectedTeamBPlayerIds";

    setNewMatchDraft((current) => ({
      ...current,
      [field]: current[field].includes(playerId)
        ? current[field].filter((id) => id !== playerId)
        : [...current[field], playerId]
    }));
  }

  function chooseMatchTeam(teamSide: "A" | "B", teamId: string) {
    const team = store.teams.find((storedTeam) => storedTeam.id === teamId);

    setNewMatchDraft((current) => ({
      ...current,
      [teamSide === "A" ? "teamAId" : "teamBId"]: teamId,
      [teamSide === "A" ? "teamAName" : "teamBName"]: team?.name ?? current[teamSide === "A" ? "teamAName" : "teamBName"],
      [teamSide === "A" ? "selectedTeamAPlayerIds" : "selectedTeamBPlayerIds"]: []
    }));
  }

  async function selectMatchVideoSlot(slotIndex: number) {
    setWorkingCopyProgress(null);

    try {
      const selectedVideo = await window.clipboardCoach.openVideo();

      if (!selectedVideo) {
        return;
      }

      setNewMatchDraft((current) => ({
        ...current,
        videoSlots: current.videoSlots.map((slot, index) => (index === slotIndex ? selectedVideo : slot))
      }));
    } catch (error) {
      console.error("Video could not be selected:", error);
      setStatus("Video could not be opened or converted.");
    } finally {
      setWorkingCopyProgress(null);
    }
  }

  function addMatchVideoSlot() {
    setNewMatchDraft((current) => ({ ...current, videoSlots: [...current.videoSlots, null] }));
  }

  function getLinkedVideoRecord(videoFile: VideoFile, matchId: string, blockNumber: number): StoredVideo {
    return {
      path: videoFile.path,
      name: videoFile.name,
      extension: videoFile.extension,
      lastOpenedAt: new Date().toISOString(),
      tags: [],
      matchId,
      matchBlockNumber: blockNumber,
      matchBlockLabel: `Blok ${blockNumber}`,
      matchBlockStartMinute: (blockNumber - 1) * 20,
      originalSourcePath: videoFile.originalSourcePath ?? videoFile.path,
      playbackPath: videoFile.playbackPath,
      compatibleWorkingCopyPath: videoFile.compatibleWorkingCopyPath,
      mediaInfo: videoFile.mediaInfo,
      workingCopy: videoFile.workingCopy
    };
  }

  async function createMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const now = new Date().toISOString();
    const selectedVideos = newMatchDraft.videoSlots.filter((slot): slot is VideoFile => slot !== null);
    const nextMatch: StoredMatch = {
      id: crypto.randomUUID(),
      date: newMatchDraft.date,
      startTime: newMatchDraft.startTime || undefined,
      teamAName: getMatchTeamName(newMatchDraft.teamAId, newMatchDraft.teamAName),
      teamBName: getMatchTeamName(newMatchDraft.teamBId, newMatchDraft.teamBName),
      teamAId: newMatchDraft.teamAId || undefined,
      teamBId: newMatchDraft.teamBId || undefined,
      selectedTeamAPlayerIds: newMatchDraft.selectedTeamAPlayerIds,
      selectedTeamBPlayerIds: newMatchDraft.selectedTeamBPlayerIds,
      videoBlockIds: [],
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now
    };
    const nextVideos = { ...store.videos };

    selectedVideos.forEach((selectedVideo, index) => {
      const blockKey = createVideoBlockKey(nextMatch.id, index + 1);
      nextMatch.videoBlockIds.push(blockKey);
      nextVideos[blockKey] = getLinkedVideoRecord(selectedVideo, nextMatch.id, index + 1);
    });

    const nextStore = {
      ...store,
      matches: [...store.matches, nextMatch],
      videos: nextVideos
    };

    setScreen("video");
    setActiveMatchId(nextMatch.id);
    setMatchModalMode("select");
    setIsMatchModalOpen(false);
    resetNewMatchDraft();
    setStore(nextStore);
    await persistStore(nextStore);

    if (selectedVideos[0]) {
      prepareVideo({ ...selectedVideos[0], storeKey: nextMatch.videoBlockIds[0] });
    } else {
      setVideo(null);
      setTags([]);
    }

    setStatus("Match aangemaakt.");
  }

  async function openMatch(matchId: string) {
    const match = store.matches.find((storedMatch) => storedMatch.id === matchId);

    if (!match) {
      return;
    }

    const now = new Date().toISOString();
    const nextStore = {
      ...store,
      matches: store.matches.map((storedMatch) =>
        storedMatch.id === match.id ? { ...storedMatch, lastOpenedAt: now, updatedAt: now } : storedMatch
      )
    };

    setStore(nextStore);
    await persistStore(nextStore);
    setActiveMatchId(match.id);
    setScreen("video");
    setMatchModalMode("select");
    setIsMatchModalOpen(false);
    setStatus("Match geopend.");

    const firstVideoPath = match.videoBlockIds.find((videoKey) => store.videos[videoKey] && !store.videos[videoKey].missing);

    if (firstVideoPath) {
      await openPreviousVideo(firstVideoPath, match.id);
      return;
    }

    setVideo(null);
    setTags([]);
  }

  async function deleteMatch(matchId: string) {
    const nextStore = {
      ...store,
      matches: store.matches.filter((match) => match.id !== matchId)
    };

    if (activeMatchId === matchId) {
      setActiveMatchId(null);
    }

    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function addVideoBlockToActiveMatch() {
    if (!activeMatch) {
      return;
    }

    const selectedVideo = await window.clipboardCoach.openVideo();

    if (!selectedVideo) {
      return;
    }

    const loadedStore = await window.clipboardCoach.loadStore();
    const match = loadedStore.matches.find((storedMatch) => storedMatch.id === activeMatch.id);

    if (!match) {
      setStatus("Wedstrijd kon niet worden gevonden.");
      return;
    }

    const nextBlockNumber = match.videoBlockIds.length + 1;
    const blockKey = createVideoBlockKey(match.id, nextBlockNumber);
    const nextMatch = {
      ...match,
      videoBlockIds: [...match.videoBlockIds, blockKey],
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString()
    };
    const nextStore = {
      ...loadedStore,
      matches: loadedStore.matches.map((storedMatch) => (storedMatch.id === match.id ? nextMatch : storedMatch)),
      videos: {
        ...loadedStore.videos,
        [blockKey]: getLinkedVideoRecord(selectedVideo, match.id, nextBlockNumber)
      }
    };

    setActiveMatchId(match.id);
    setStore(nextStore);
    await persistStore(nextStore);
    setIsMatchModalOpen(false);
    prepareVideo({ ...selectedVideo, storeKey: blockKey });
    setStatus(`${selectedVideo.name} toegevoegd als Blok ${nextBlockNumber}.`);
  }

  async function openVideo() {
    setWorkingCopyProgress(null);

    try {
      const selectedVideo = await window.clipboardCoach.openVideo();

      if (!selectedVideo) {
        return;
      }

      setActiveMatchId(null);
      prepareVideo(selectedVideo);
      await refreshStore();
    } catch (error) {
      console.error("Video could not be opened:", error);
      setStatus("Video could not be opened or converted.");
    } finally {
      setWorkingCopyProgress(null);
    }
  }

  async function openPreviousVideo(videoKey: string, matchId?: string, targetTime = 0) {
    try {
      const storedVideo = store.videos[videoKey];
      const selectedVideo = await window.clipboardCoach.openVideoFromPath(storedVideo?.path ?? videoKey);
      setActiveMatchId(matchId ?? storedVideo?.matchId ?? null);
      prepareVideo({ ...selectedVideo, storeKey: videoKey });
      setPendingSourceOpen({ videoPath: videoKey, time: targetTime });
    } catch (error) {
      console.error("Previous video could not be opened:", videoKey, error);
      setStatus("That previous video file could not be found on disk.");
    }
  }

  async function jumpToMatchTag(item: MatchTagItem) {
    setSelectedTagIds([item.selectionId]);
    setEditingTagId(null);

    if (item.videoId === currentVideoKey) {
      seekTo(item.videoTime);
      return;
    }

    await openPreviousVideo(item.videoId, activeMatch?.id, item.videoTime);
  }

  function prepareVideo(selectedVideo: VideoFile) {
    console.info("Selected video returned from Electron:", selectedVideo);
    setScreen("video");
    setVideo(selectedVideo);
    setTags([]);
    setSelectedTagIds([]);
    setEditingTagId(null);
    setExpandedTagIds([]);
    setNewTagText("");
    setIsAddTagOpen(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setPlaybackRate(1);
    setVideoError("");
    setVideoReady(false);

    const playerProbe = document.createElement("video");
    const canPlayMp4 = playerProbe.canPlayType("video/mp4");
    const isLikelySupported = playableExtensions.has(selectedVideo.extension);

    setSupportWarning(
      isLikelySupported
        ? ""
        : "This file extension is often not supported by the built-in player. If it fails, try an MP4 encoded with H.264 video and AAC audio."
    );
    setStatus(
      `Opened ${selectedVideo.name}. ${canPlayMp4 ? "MP4 playback is supported." : "MP4 support was not reported by the player."}`
    );
  }

  async function playVideo() {
    const player = videoRef.current;

    if (!player) {
      return;
    }

    try {
      player.playbackRate = 1;
      setPlaybackRate(1);
      await player.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Video playback failed:", { video, source: video?.url, error });
      setVideoError("Playback could not start. The file may use an unsupported codec.");
      setIsPlaying(false);
    }
  }

  function pauseVideo() {
    videoRef.current?.pause();
    setIsPlaying(false);
  }

  function seekBy(offsetSeconds: number) {
    seekTo(currentTime + offsetSeconds);
  }

  function speedUp() {
    const nextRate = playbackRate >= 2 ? 1 : playbackRate + 0.25;
    setPlaybackRate(nextRate);
    setStatus(`Playback speed set to ${nextRate}x.`);
  }

  async function saveTags(nextTags: VideoTag[]) {
    if (!video || !currentVideoKey) {
      return;
    }

    const normalizedTags = nextTags.map(normalizeTag);
    const savedTags = await window.clipboardCoach.saveTags(currentVideoKey, normalizedTags);
    setTags(savedTags.map(normalizeTag));
    setStatus(`Saved ${savedTags.length} ${savedTags.length === 1 ? "tag" : "tags"} locally.`);
    await refreshStore();
  }

  async function createTagAtCurrentTime(label: string, playerIds: string[] = []) {
    if (!video || !currentVideoKey || !videoRef.current || label.trim().length === 0) {
      return;
    }

    const currentVideoTime = videoRef.current.currentTime;
    const baseLabel = label.trim();

    const isStandardTag = standardTags.includes(baseLabel);
    let trimmedLabel = baseLabel;
    if (!isStandardTag) {
      const existingCount = tags.filter((t) => {
        const base = t.label.replace(/\s*\(\d+\)$/, "");
        return base === baseLabel;
      }).length;
      if (existingCount > 0) {
        trimmedLabel = `${baseLabel} (${existingCount + 1})`;
      }
    }

    const nextTag: VideoTag = {
      id: crypto.randomUUID(),
      time: currentVideoTime,
      startTime: currentVideoTime,
      endTime: Math.min(duration || currentVideoTime + 5, currentVideoTime + 5),
      label: trimmedLabel,
      color: getTagColor(trimmedLabel),
      playerIds,
      playerRefs: playerIds.map((playerId) => getPlayerReferenceById(playerId)),
      createdAt: new Date().toISOString()
    };
    const nextTags = [...tags, nextTag];

    setSelectedTagIds([nextTag.id, getTagSelectionId(currentVideoKey, nextTag.id)]);
    setExpandedTagIds([nextTag.id]);
    setEditingTagId(null);
    await saveTags(nextTags);
  }

  function openAddTagModal() {
    if (!video || !videoRef.current) {
      return;
    }

    pauseVideo();
    setNewTagText("");
    setAddTagError("");
    setIsAddTagOpen(true);
  }

  async function confirmAddTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newTagText.trim().length === 0) {
      setAddTagError("Enter a tag name");
      addTagInputRef.current?.focus();
      return;
    }

    await createTagAtCurrentTime(newTagText, activePlayerIds);
    setNewTagText("");
    setAddTagError("");
    setIsAddTagOpen(false);
  }

  function selectTag(tagId: string) {
    setSelectedTagIds((current) => (current.includes(tagId) ? current : [tagId, ...current]));
  }

  function jumpToTagStart(tag: VideoTag) {
    setSelectedTagIds((current) => (current.includes(tag.id) ? current : [tag.id, ...current]));
    seekTo(tag.startTime ?? tag.time);
  }

  function toggleTagSelection(tagId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [tagId, ...current]
    );
  }

  async function saveSelectedTagDraft() {
    if (!editingTag) {
      return;
    }

    const label = tagDraft.label.trim() || editingTag.label;
    const parsedStart = parseClockTime(tagDraft.startTime);
    const parsedEnd = parseClockTime(tagDraft.endTime);

    if (parsedStart === null || parsedEnd === null) {
      setTagDraftError("Use HH:MM:SS for start and end.");
      return;
    }

    const startTime = Math.max(0, parsedStart);
    const endTime = parsedEnd;

    if (endTime <= startTime) {
      setTagDraftError("End time must be after start time.");
      return;
    }

    if (duration > 0 && endTime > duration) {
      setTagDraftError("End time cannot be after the video duration.");
      return;
    }

    const nextTags = tags.map((tag) =>
      tag.id === editingTag.id
        ? {
            ...normalizeTag(tag),
            label,
            time: startTime,
            startTime,
            endTime,
            color: getTagColor(label)
          }
        : tag
    );

    await saveTags(nextTags);
    setTagDraftError("");
  }

  async function updateEditingTagPlayers(playerId: string) {
    if (!editingTag) {
      return;
    }

    const currentPlayerIds = [...new Set([...(editingTag.playerIds ?? []), ...(editingTag.playerRefs ?? []).map((player) => player.id)])];
    const nextPlayerIds = currentPlayerIds.includes(playerId)
      ? currentPlayerIds.filter((id) => id !== playerId)
      : [...currentPlayerIds, playerId];
    const nextTags = tags.map((tag) =>
      tag.id === editingTag.id
        ? {
            ...tag,
            playerIds: nextPlayerIds,
            playerRefs: nextPlayerIds.map((nextPlayerId) => getPlayerReferenceById(nextPlayerId, tag))
          }
        : tag
    );

    await saveTags(nextTags);
  }

  async function deleteTag(tagId: string) {
    if (!window.confirm("Are you sure you want to delete this tag?")) {
      return;
    }

    const nextTags = tags.filter((tag) => tag.id !== tagId);
    setSelectedTagIds((current) => current.filter((id) => id !== tagId && !id.endsWith(`::${tagId}`)));
    setExpandedTagIds((current) => current.filter((id) => id !== tagId));
    setEditingTagId((current) => (current === tagId ? null : current));
    await saveTags(nextTags);
  }

  function seekTo(time: number) {
    const nextTime = Math.min(Math.max(time, 0), duration || 0);

    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
    }

    setCurrentTime(nextTime);
  }

  function captureFrameForDrawing(tagId: string) {
    const player = videoRef.current;

    if (!player || !player.videoWidth || !player.videoHeight) {
      setDrawingCaptureError("Video frame not ready yet.");
      return;
    }

    player.pause();
    setIsPlaying(false);
    setDrawingCaptureError("");

    const canvas = document.createElement("canvas");
    canvas.width = player.videoWidth;
    canvas.height = player.videoHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      setDrawingCaptureError("Could not capture frame.");
      return;
    }

    context.drawImage(player, 0, 0, canvas.width, canvas.height);

    try {
      const dataUrl = canvas.toDataURL("image/png");
      setEditingDrawing({ tagId, drawingId: null, imageUrl: dataUrl, initialShapes: [], videoTime: player.currentTime });
    } catch (error) {
      console.error("Frame capture failed:", error);
      setDrawingCaptureError("Could not capture this frame (video source restriction).");
    }
  }

  function openExistingDrawing(tagId: string, drawingId: string) {
    const drawing = tagDrawings[tagId]?.find((entry) => entry.id === drawingId);

    if (!drawing) {
      return;
    }

    setEditingDrawing({
      tagId,
      drawingId: drawing.id,
      imageUrl: drawing.baseFrameUrl,
      initialShapes: drawing.shapes,
      videoTime: drawing.videoTime
    });
  }

  async function duplicateDrawing(tagId: string, drawingId: string) {
    const drawing = tagDrawings[tagId]?.find((entry) => entry.id === drawingId);

    if (!drawing) {
      return;
    }

    const newDrawing = {
      id: crypto.randomUUID(),
      baseFrameUrl: drawing.baseFrameUrl,
      shapes: drawing.shapes,
      thumbnailUrl: drawing.thumbnailUrl,
      videoTime: drawing.videoTime,
      durationSeconds: drawing.durationSeconds
    };
    const nextDrawings = [...(tagDrawings[tagId] ?? []), newDrawing];
    setTagDrawings((current) => ({ ...current, [tagId]: nextDrawings }));
    await persistTagDrawingsToStore(tagId, nextDrawings);
    setEditingDrawing({
      tagId,
      drawingId: newDrawing.id,
      imageUrl: newDrawing.baseFrameUrl,
      initialShapes: newDrawing.shapes,
      videoTime: newDrawing.videoTime
    });
  }

  async function persistTagDrawingsToStore(
    tagId: string,
    nextDrawings: { id: string; baseFrameUrl: string; shapes: Shape[]; thumbnailUrl: string; videoTime: number; durationSeconds: number }[]
  ) {
    const nextTags = tags.map((tag) =>
      tag.id === tagId
        ? {
            ...tag,
            drawings: nextDrawings.map((d) => ({
              id: d.id,
              baseFrameUrl: d.baseFrameUrl,
              shapes: d.shapes,
              thumbnailUrl: d.thumbnailUrl,
              videoTime: d.videoTime,
              durationSeconds: d.durationSeconds
            }))
          }
        : tag
    );
    await saveTags(nextTags);
  }

  async function deleteDrawingFrame(tagId: string, drawingId: string) {
    if (!currentVideoKey) {
      return;
    }

    if (!window.confirm("Delete this complete picture/freeze-frame? This removes the picture and all annotations on it.")) {
      return;
    }

    const existing = tagDrawings[tagId] ?? [];
    const nextDrawings = existing.filter((entry) => entry.id !== drawingId);
    const nextTags = tags.map((tag) =>
      tag.id === tagId
        ? {
            ...tag,
            drawings: nextDrawings.map((d) => ({
              id: d.id,
              baseFrameUrl: d.baseFrameUrl,
              shapes: d.shapes,
              thumbnailUrl: d.thumbnailUrl,
              videoTime: d.videoTime,
              durationSeconds: d.durationSeconds
            }))
          }
        : tag
    );

    setTagDrawings((current) => ({ ...current, [tagId]: nextDrawings }));
    if (editingDrawing?.drawingId === drawingId) {
      setEditingDrawing(null);
      setIsDrawingMaximized(false);
    }
    setDrawingPlayback((current) => (current?.drawing.id === drawingId ? null : current));
    drawingTriggerHandledRef.current = false;
    pendingDrawingIndexRef.current = 0;

    const savedTags = await window.clipboardCoach.saveTags(currentVideoKey, nextTags.map(normalizeTag));
    setTags(savedTags.map(normalizeTag));

    const loadedStore = await window.clipboardCoach.loadStore();
    const nextStore: AppStore = {
      ...loadedStore,
      clips: loadedStore.clips.map((clip) =>
        clip.tagSnapshots
          ? {
              ...clip,
              tagSnapshots: clip.tagSnapshots.map((snapshot) =>
                snapshot.id === tagId && (!snapshot.sourceVideoId || snapshot.sourceVideoId === currentVideoKey)
                  ? {
                      ...snapshot,
                      drawings: (snapshot.drawings ?? []).filter((drawing) => drawing.id !== drawingId)
                    }
                  : snapshot
              )
            }
          : clip
      )
    };

    await persistStore(nextStore);
    setStatus("Picture/freeze-frame deleted.");
  }

  async function saveEditingDrawing(dataUrl: string, shapes: Shape[]) {
    if (!editingDrawing) {
      return;
    }

    const { tagId, drawingId, imageUrl, videoTime } = editingDrawing;
    let nextDrawings: typeof tagDrawings[string];

    const existing = tagDrawings[tagId] ?? [];

    if (drawingId) {
      nextDrawings = existing.map((entry) =>
        entry.id === drawingId ? { ...entry, shapes, thumbnailUrl: dataUrl } : entry
      );
    } else {
      nextDrawings = [...existing, { id: crypto.randomUUID(), baseFrameUrl: imageUrl, shapes, thumbnailUrl: dataUrl, videoTime, durationSeconds: 5 }];
    }

    setTagDrawings((current) => ({ ...current, [tagId]: nextDrawings }));
    setEditingDrawing(null);
    setIsDrawingMaximized(false);

    await persistTagDrawingsToStore(tagId, nextDrawings);
    setStatus("Tekening opgeslagen.");
  }

  function closeDrawingFrame() {
    setEditingDrawing(null);
    setDrawingCaptureError("");
    setIsDrawingMaximized(false);
  }

  function handleVideoError() {
    const player = videoRef.current;
    const message = getVideoErrorMessage(player?.error ?? null);

    console.error("Video load error:", {
      file: video,
      source: video?.url,
      mediaError: player?.error ?? null,
      networkState: player?.networkState,
      readyState: player?.readyState
    });
    setVideoError(message);
    setVideoReady(false);
    setIsPlaying(false);
    setStatus("Video failed to load.");
  }

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (teamText.trim().length === 0) {
      return;
    }

    const nextStore = {
      ...store,
      teams: [
        ...store.teams,
        {
          id: crypto.randomUUID(),
          name: teamText.trim(),
          players: [],
          createdAt: new Date().toISOString()
        }
      ]
    };

    setTeamText("");
    const createdTeamId = nextStore.teams[nextStore.teams.length - 1].id;
    nextStore.settings = { ...nextStore.settings, lastSelectedTeamId: createdTeamId };
    setSelectedTeamId(createdTeamId);
    setStore(nextStore);
    await persistStore(nextStore);
  }

  function updateCreateTeamPlayer(index: number, field: "firstName" | "lastName" | "email", value: string) {
    setCreateTeamDraft((current) => ({
      ...current,
      players: current.players.map((player, playerIndex) =>
        playerIndex === index ? { ...player, [field]: value } : player
      )
    }));
  }

  function addCreateTeamPlayerRow() {
    setCreateTeamDraft((current) => ({
      ...current,
      players: [...current.players, { firstName: "", lastName: "", email: "" }]
    }));
  }

  async function createTeamWithPlayers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const teamName = createTeamDraft.name.trim();

    if (teamName.length === 0) {
      return;
    }

    const players = createTeamDraft.players
      .map((player) => ({
        firstName: player.firstName.trim(),
        lastName: player.lastName.trim(),
        email: player.email.trim()
      }))
      .filter((player) => player.firstName.length > 0 || player.lastName.length > 0 || player.email.length > 0)
      .map((player) => ({
        id: crypto.randomUUID(),
        firstName: player.firstName,
        lastName: player.lastName,
        email: player.email,
        name: `${player.firstName} ${player.lastName}`.trim(),
        createdAt: new Date().toISOString()
      }));
    const nextTeam = {
      id: crypto.randomUUID(),
      name: teamName,
      players,
      createdAt: new Date().toISOString()
    };
    const nextStore = {
      ...store,
      teams: [...store.teams, nextTeam],
      settings: { ...store.settings, lastSelectedTeamId: nextTeam.id }
    };

    setCreateTeamDraft({ name: "", players: [{ firstName: "", lastName: "", email: "" }] });
    setIsCreateTeamModalOpen(false);
    setSelectedTeamId(nextTeam.id);
    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function deleteTeam(teamId: string) {
    const remainingTeams = store.teams.filter((team) => team.id !== teamId);
    const nextSelectedTeamId = remainingTeams[0]?.id ?? null;
    const nextStore = {
      ...store,
      teams: remainingTeams,
      settings: { ...store.settings, lastSelectedTeamId: nextSelectedTeamId ?? undefined }
    };
    setSelectedTeamId(nextSelectedTeamId);
    if (videoTeamId === teamId) {
      setVideoTeamId("");
      setActivePlayerIds([]);
      if (video) {
        nextStore.videos = {
          ...nextStore.videos,
          [video.path]: {
            ...(nextStore.videos[video.path] ?? {
              path: video.path,
              name: video.name,
              extension: video.extension,
              lastOpenedAt: new Date().toISOString(),
              tags
            }),
            matchState: undefined
          }
        };
      }
    }
    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function saveTeamName(teamId: string) {
    const nextName = teamNameDraft.trim();

    if (nextName.length === 0) {
      return;
    }

    const nextStore = {
      ...store,
      teams: store.teams.map((team) => (team.id === teamId ? { ...team, name: nextName } : team))
    };

    setEditingTeamId(null);
    setTeamNameDraft("");
    setStore(nextStore);
    await persistStore(nextStore);
  }

  function startEditingPlayer(player: Player) {
    setEditingPlayerId(player.id);
    setPlayerEditDraft({
      firstName: player.firstName ?? "",
      lastName: player.lastName ?? "",
      email: player.email ?? ""
    });
  }

  async function savePlayerEdit(teamId: string, playerId: string) {
    const firstName = playerEditDraft.firstName.trim();
    const lastName = playerEditDraft.lastName.trim();
    const email = playerEditDraft.email.trim();
    const nextStore = {
      ...store,
      teams: store.teams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: team.players.map((player) =>
                player.id === playerId
                  ? {
                      ...player,
                      firstName,
                      lastName,
                      email,
                      name: `${firstName} ${lastName}`.trim()
                    }
                  : player
              )
            }
          : team
      )
    };

    setEditingPlayerId(null);
    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function saveMatchInfoEdit() {
    if (!activeMatch) {
      return;
    }

    const now = new Date().toISOString();
    const nextStore = {
      ...store,
      matches: store.matches.map((match) =>
        match.id === activeMatch.id
          ? {
              ...match,
              date: matchEditDraft.date,
              startTime: matchEditDraft.startTime || undefined,
              teamAName: matchEditDraft.teamAName.trim(),
              teamBName: matchEditDraft.teamBName.trim(),
              selectedTeamAPlayerIds: matchEditDraft.selectedTeamAPlayerIds,
              selectedTeamBPlayerIds: matchEditDraft.selectedTeamBPlayerIds,
              updatedAt: now
            }
          : match
      )
    };

    setIsEditingMatchInfo(false);
    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>, teamId: string) {
    event.preventDefault();
    const playerDraft = playerDraftByTeam[teamId] ?? { firstName: "", lastName: "", email: "" };
    const firstName = playerDraft.firstName.trim();
    const lastName = playerDraft.lastName.trim();
    const email = playerDraft.email.trim();

    if (firstName.length === 0 && lastName.length === 0) {
      return;
    }

    const nextStore = {
      ...store,
      teams: store.teams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: [
                ...team.players,
                {
                  id: crypto.randomUUID(),
                  firstName,
                  lastName,
                  email,
                  name: `${firstName} ${lastName}`.trim(),
                  createdAt: new Date().toISOString()
                }
              ]
            }
          : team
      )
    };

    setPlayerDraftByTeam((current) => ({ ...current, [teamId]: { firstName: "", lastName: "", email: "" } }));
    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function saveAddPlayer(teamId: string) {
    const firstName = addPlayerDraft.firstName.trim();
    const lastName = addPlayerDraft.lastName.trim();
    if (!firstName && !lastName) return;
    const nextStore = {
      ...store,
      teams: store.teams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: [
                ...team.players,
                { id: crypto.randomUUID(), firstName, lastName, email: addPlayerDraft.email.trim(), name: `${firstName} ${lastName}`.trim(), role: addPlayerDraft.role, createdAt: new Date().toISOString() }
              ]
            }
          : team
      )
    };
    setStore(nextStore);
    await persistStore(nextStore);
    setAddPlayerModalTeamId(null);
    setAddPlayerDraft({ firstName: "", lastName: "", email: "", role: "player" });
  }

  async function deletePlayer(teamId: string, playerId: string) {
    const nextActivePlayerIds =
      teamId === videoTeamId ? activePlayerIds.filter((activePlayerId) => activePlayerId !== playerId) : activePlayerIds;
    const nextStore = {
      ...store,
      teams: store.teams.map((team) =>
        team.id === teamId
          ? { ...team, players: team.players.filter((player) => player.id !== playerId) }
          : team
      ),
      videos:
        video && teamId === videoTeamId
          ? {
              ...store.videos,
              [video.path]: {
                ...(store.videos[video.path] ?? {
                  path: video.path,
                  name: video.name,
                  extension: video.extension,
                  lastOpenedAt: new Date().toISOString(),
                  tags
                }),
                matchState: buildMatchState(videoTeamId, nextActivePlayerIds, store)
              }
            }
          : store.videos
    };
    setActivePlayerIds(nextActivePlayerIds);
    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function addQuickPlayerToVideoTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const firstName = quickPlayerDraft.firstName.trim();
    const lastName = quickPlayerDraft.lastName.trim();
    const email = quickPlayerDraft.email.trim();

    if (!videoTeam || (firstName.length === 0 && lastName.length === 0)) {
      return;
    }

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      firstName,
      lastName,
      email,
      name: `${firstName} ${lastName}`.trim(),
      createdAt: new Date().toISOString()
    };
    const nextActivePlayerIds = [...activePlayerIds, newPlayer.id];
    const nextStore = {
      ...store,
      teams: store.teams.map((team) =>
        team.id === videoTeam.id ? { ...team, players: [...team.players, newPlayer] } : team
      ),
      videos: video
        ? {
            ...store.videos,
            [video.path]: {
              ...(store.videos[video.path] ?? {
                path: video.path,
                name: video.name,
                extension: video.extension,
                lastOpenedAt: new Date().toISOString(),
                tags
              }),
              matchState: {
                teamId: videoTeam.id,
                teamName: videoTeam.name,
                players: nextActivePlayerIds.map((playerId) => {
                  if (playerId === newPlayer.id) {
                    return { id: newPlayer.id, name: getPlayerDisplayName(newPlayer) };
                  }

                  const player = videoTeam.players.find((storedPlayer) => storedPlayer.id === playerId);
                  return { id: playerId, name: player ? getPlayerDisplayName(player) : "Saved player" };
                })
              }
            }
          }
        : store.videos,
      settings: {
        ...store.settings
      }
    };

    setQuickPlayerDraft({ firstName: "", lastName: "", email: "" });
    setActivePlayerIds(nextActivePlayerIds);
    setIsPlayerModalOpen(false);
    setStore(nextStore);
    await persistStore(nextStore);
  }

  function openTeamModal() {
    setMatchTeamDraftId(videoTeamId);
    setMatchPlayerDraftIds(activePlayerIds);
    setIsTeamModalOpen(true);
  }

  function cancelTeamModal() {
    setIsTeamModalOpen(false);
    setMatchTeamDraftId(videoTeamId);
    setMatchPlayerDraftIds(activePlayerIds);
  }

  function chooseMatchDraftTeam(teamId: string) {
    setMatchTeamDraftId(teamId);
    setMatchPlayerDraftIds([]);
  }

  function toggleMatchDraftPlayer(playerId: string) {
    setMatchPlayerDraftIds((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    );
  }

  async function confirmTeamModal() {
    setVideoTeamId(matchTeamDraftId);
    setActivePlayerIds(matchPlayerDraftIds);
    setIsTeamModalOpen(false);
    await persistVideoMatchState(matchTeamDraftId, matchPlayerDraftIds);
  }

  async function addStandardTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tagName = newStandardTagText.trim();

    if (tagName.length === 0 || standardTags.some((tag) => tag.toLowerCase() === tagName.toLowerCase())) {
      return;
    }

    const nextStandardTags = [...standardTags, tagName];
    setStandardTags(nextStandardTags);
    setNewStandardTagText("");
    await persistSettings({ standardTags: nextStandardTags });
  }

  async function removeStandardTag(tagName: string) {
    if (tagName === "Start" || tagName === "Goal") {
      return;
    }

    const nextStandardTags = standardTags.filter((tag) => tag !== tagName);
    setStandardTags(nextStandardTags);
    await persistSettings({ standardTags: nextStandardTags });
  }

  function getPlayerById(playerId: string) {
    return store.teams.flatMap((team) => team.players).find((player) => player.id === playerId) ?? null;
  }

  function getPlayerReferenceById(playerId: string, tag?: VideoTag): PlayerReference {
    const player = getPlayerById(playerId);

    if (player) {
      return getPlayerReference(player);
    }

    const savedTagRef = tag?.playerRefs?.find((playerRef) => playerRef.id === playerId);
    const savedMatchRef = currentVideoRecord?.matchState?.players.find((playerRef) => playerRef.id === playerId);

    return {
      id: playerId,
      name: savedTagRef ? getPlayerReferenceName(savedTagRef) : savedMatchRef?.name ?? "Saved player",
      firstName: savedTagRef?.firstName,
      lastName: savedTagRef?.lastName
    };
  }

  function getTagPlayerNames(tag: VideoTag | ClipTagSnapshot) {
    const byRef = (tag.playerRefs ?? []).map(getPlayerReferenceName);
    const byId = (tag.playerIds ?? []).map((playerId) => getPlayerReferenceById(playerId).name);

    return [...new Set([...byRef, ...byId])].filter(Boolean);
  }

  function getEditablePlayersForTag(tag: VideoTag) {
    const playersById = new Map<string, Player>();

    for (const player of [...videoTeamPlayers, ...activePlayers]) {
      playersById.set(player.id, player);
    }

    for (const playerRef of tag.playerRefs ?? []) {
      if (!playersById.has(playerRef.id)) {
        playersById.set(playerRef.id, {
          id: playerRef.id,
          name: getPlayerReferenceName(playerRef),
          firstName: playerRef.firstName,
          lastName: playerRef.lastName,
          createdAt: ""
        });
      }
    }

    for (const playerId of tag.playerIds ?? []) {
      if (!playersById.has(playerId)) {
        const playerRef = getPlayerReferenceById(playerId, tag);
        playersById.set(playerId, {
          id: playerRef.id,
          name: playerRef.name,
          firstName: playerRef.firstName,
          lastName: playerRef.lastName,
          createdAt: ""
        });
      }
    }

    return getSortedPlayers([...playersById.values()]);
  }

  function getClipBaseName(selectedTags: VideoTag[]) {
    if (selectedTags.length === 0) {
      return "Clip";
    }

    const uniqueTagNames = [...new Set(selectedTags.map((tag) => tag.label))];

    if (uniqueTagNames.length === 1) {
      return `${uniqueTagNames[0]} Clips`;
    }

    const firstPlayerName = selectedTags.flatMap(getTagPlayerNames)[0];

    if (firstPlayerName) {
      return `${firstPlayerName} Clips`;
    }

    return "Selected Tags Clips";
  }

  function getSuggestedClipName(selectedTagIdsForName: string[]) {
    const selectedTagsForName = visibleTagItems
      .filter((item) => selectedTagIdsForName.includes(item.selectionId))
      .map((item) => item.tag);
    return getUniqueName(getClipBaseName(selectedTagsForName), store.clips.map((clip) => clip.name));
  }

  function openClipBuilder() {
    if (!video) {
      return;
    }

    const visibleSelectionIds = new Set(visibleTagItems.map((item) => item.selectionId));
    const initiallySelectedTags = selectedTagIds.filter((tagId) => visibleSelectionIds.has(tagId));
    setClipDraft({
      name: getSuggestedClipName(initiallySelectedTags),
      selectedTagIds: initiallySelectedTags,
      teamId: videoTeam?.id ?? "",
      audienceType: "full_team",
      includeStaff: false,
      specificPlayerIds: []
    });
    setIsClipNameTouched(false);
    setIsClipBuilderOpen(true);
  }

  function toggleClipDraftTag(tagId: string) {
    setClipDraft((current) => ({
      ...current,
      selectedTagIds: current.selectedTagIds.includes(tagId)
        ? current.selectedTagIds.filter((selectedTagId) => selectedTagId !== tagId)
        : [...current.selectedTagIds, tagId],
      name: isClipNameTouched
        ? current.name
        : getSuggestedClipName(
            current.selectedTagIds.includes(tagId)
              ? current.selectedTagIds.filter((selectedTagId) => selectedTagId !== tagId)
              : [...current.selectedTagIds, tagId]
          )
    }));
  }

  function selectClipTagsByName(tagName: string) {
    const matchingTagIds = visibleTagItems.filter((item) => item.tag.label === tagName).map((item) => item.selectionId);
    setClipDraft((current) => ({
      ...current,
      selectedTagIds: [...new Set([...current.selectedTagIds, ...matchingTagIds])],
      name: isClipNameTouched ? current.name : getUniqueName(`${tagName} Clips`, store.clips.map((clip) => clip.name))
    }));
  }

  function chooseClipDraftTeam(teamId: string) {
    const nextTeam = teamId ? store.teams.find((team) => team.id === teamId) ?? null : null;
    const validPlayerIds = new Set((nextTeam?.players ?? []).filter((player) => player.role !== "staff").map((player) => player.id));

    setClipDraft((current) => ({
      ...current,
      teamId: nextTeam?.id ?? "",
      audienceType: nextTeam ? current.audienceType : "full_team",
      includeStaff: nextTeam ? current.includeStaff : false,
      specificPlayerIds: current.specificPlayerIds.filter((playerId) => validPlayerIds.has(playerId))
    }));
  }

  function toggleSpecificClipPlayer(playerId: string) {
    setClipDraft((current) => ({
      ...current,
      specificPlayerIds: current.specificPlayerIds.includes(playerId)
        ? current.specificPlayerIds.filter((selectedPlayerId) => selectedPlayerId !== playerId)
        : [...current.specificPlayerIds, playerId]
    }));
  }

  function getClipAudienceForDraft(): ClipAudience | undefined {
    if (!clipDraftTeam) {
      return undefined;
    }

    if (clipDraft.audienceType === "full_team") {
      return {
        type: "full_team",
        teamId: clipDraftTeam.id,
        teamName: clipDraftTeam.name,
        players: []
      };
    }

    const sourcePlayers =
      clipDraft.audienceType === "selected_match_players"
        ? clipDraftMatchPlayers
        : clipDraftPlayers.filter((player) => clipDraft.specificPlayerIds.includes(player.id));

    return {
      type: clipDraft.audienceType,
      teamId: clipDraftTeam.id,
      teamName: clipDraftTeam.name,
      players: sourcePlayers.map((player) => ({ id: player.id, name: getPlayerDisplayName(player) }))
    };
  }

  async function createClipRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!video || clipDraft.selectedTagIds.length === 0) {
      return;
    }

    const selectedClipItems = visibleTagItems.filter((item) => clipDraft.selectedTagIds.includes(item.selectionId));
    const selectedClipTags = selectedClipItems.map((item) => item.tag);
    const clipName = getUniqueName(
      clipDraft.name.trim() || getClipBaseName(selectedClipTags),
      store.clips.map((clip) => clip.name)
    );
    const newClip: ClipRecord = {
      id: crypto.randomUUID(),
      name: clipName,
      filePath: "",
      teamId: clipDraftTeam?.id,
      teamName: clipDraftTeam?.name,
      sourceVideoPath: selectedClipItems[0]?.sourceVideoPath ?? video.path,
      sourceVideoName: store.videos[selectedClipItems[0]?.videoId ?? ""]?.name ?? video.name,
      matchTitle: getMatchInfoTitle(currentVideoRecord?.matchInfo, video.name),
      startTime: Math.min(...selectedClipTags.map((tag) => tag.startTime ?? tag.time)),
      endTime: Math.max(...selectedClipTags.map((tag) => tag.endTime ?? (tag.startTime ?? tag.time) + 5)),
      selectedTagIds: selectedClipItems.map((item) => item.selectionId),
      tagNames: [...new Set(selectedClipTags.map((tag) => tag.label))],
      tagSnapshots: selectedClipItems.map((item) => ({
        id: item.tag.id,
        label: item.tag.label,
        startTime: item.tag.startTime ?? item.tag.time,
        endTime: item.tag.endTime ?? (item.tag.startTime ?? item.tag.time) + 5,
        sourceVideoId: item.videoId,
        sourceVideoPath: item.sourceVideoPath,
        blockNumber: item.blockNumber,
        blockLabel: item.blockLabel,
        blockStartMinute: item.blockStartMinute,
        playerIds: item.tag.playerIds ?? [],
        playerRefs: [
          ...(item.tag.playerRefs ?? []),
          ...(item.tag.playerIds ?? [])
            .filter((playerId) => !item.tag.playerRefs?.some((playerRef) => playerRef.id === playerId))
            .map((playerId) => getPlayerReferenceById(playerId, item.tag))
        ],
        drawings: (tagDrawings[item.tag.id] ?? [])
          .map((d) => ({ id: d.id, dataUrl: d.thumbnailUrl, durationSeconds: d.durationSeconds, videoTime: d.videoTime }))
          .sort((a, b) => a.videoTime - b.videoTime)
      })),
      intendedAudience: getClipAudienceForDraft(),
      exportStatus: "prepared_only",
      localClipPath: null,
      shareUrl: null,
      uploadStatus: "not_uploaded",
      missingExportFile: true,
      shareWithStaff: !!clipDraftTeam && clipDraft.includeStaff,
      createdAt: new Date().toISOString(),
      missing: true
    };
    const nextStore = { ...store, clips: [newClip, ...store.clips] };

    setIsClipBuilderOpen(false);
    await persistStore(nextStore);
    setLastSavedClipId(newClip.id);
    setStatus(`Clip record saved: ${newClip.name}.`);
  }

  async function deleteClipRecord(clipId: string) {
    const nextStore = { ...store, clips: store.clips.filter((clip) => clip.id !== clipId) };
    setPendingClipDeleteId(null);
    setSelectedClipId((current) => (current === clipId ? null : current));
    await persistStore(nextStore);
  }

  async function toggleClipShareWithStaff(clip: ClipRecord) {
    if (!getClipTeamId(clip)) {
      return;
    }

    const nextStore = {
      ...store,
      clips: store.clips.map((c) => c.id === clip.id ? { ...c, shareWithStaff: !c.shareWithStaff } : c)
    };
    await persistStore(nextStore);
  }

  async function renameSelectedClip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedClip) {
      return;
    }

    const nextName = getUniqueName(
      clipRenameText.trim() || selectedClip.name,
      store.clips.map((clip) => clip.name),
      selectedClip.name
    );
    const nextStore = {
      ...store,
      clips: store.clips.map((clip) => (clip.id === selectedClip.id ? { ...clip, name: nextName } : clip))
    };

    setClipRenameText(nextName);
    setIsEditingClipName(false);
    await persistStore(nextStore);
  }

  async function exportSelectedClip() {
    if (!selectedClip || selectedClipSegments.length === 0 || exportingClipId) {
      return;
    }

    const clipId = selectedClip.id;
    const segments: ClipExportSegment[] = selectedClipSegments.map((segment) => ({
      sourceVideoPath: segment.sourceVideoPath ?? selectedClip.sourceVideoPath ?? "",
      startTime: segment.startTime,
      endTime: segment.endTime,
      drawings: (segment.drawings ?? []).map((d) => ({ dataUrl: d.dataUrl, durationSeconds: d.durationSeconds, videoTime: d.videoTime }))
    }));

    if (segments.some((segment) => !segment.sourceVideoPath)) {
      setExportError("Source video missing - cannot export.");
      return;
    }

    setExportingClipId(clipId);
    setExportProgress(0);
    setExportError("");

    const unsubscribe = window.clipboardCoach.onClipExportProgress((progress) => {
      if (progress.clipId === clipId) {
        setExportProgress(progress.progress);
      }
    });

    try {
      const result = await window.clipboardCoach.exportClip({
        clipId,
        segments,
        suggestedName: `${selectedClip.name}.mp4`
      });

      if (result) {
        setStatus(`Clip exported to ${result.filePath}.`);
        await refreshStore();
      }
    } catch (error) {
      console.error("Clip export failed:", error);
      setExportError("Export failed. Check that the source videos are still available.");
    } finally {
      unsubscribe();
      setExportingClipId(null);
    }
  }

  async function saveSelectedClipAs() {
    if (!selectedClip || !selectedClip.localClipPath || isSavingClipAs) {
      return;
    }

    setIsSavingClipAs(true);
    setExportError("");

    try {
      const savedPath = await window.clipboardCoach.saveClipAs(
        selectedClip.localClipPath,
        `${selectedClip.name}.mp4`
      );

      if (savedPath) {
        setStatus(`Clip saved to ${savedPath}.`);
      }
    } catch (error) {
      console.error("Save clip as failed:", error);
      setExportError("Saving the clip failed.");
    } finally {
      setIsSavingClipAs(false);
    }
  }

  function openClipDetails(clipId: string) {
    setSelectedClipId(clipId);
  }

  async function playClipSegment(
    segmentIndex: number,
    options: { autoplay?: boolean; sourceTime?: number } = {}
  ) {
    const segment = selectedClipSegments[segmentIndex];

    if (!segment) {
      return;
    }

    const autoplay = options.autoplay ?? true;
    const targetTime = options.sourceTime ?? segment.startTime;
    const targetSourcePath = segment.sourceVideoPath ?? selectedClip?.sourceVideoPath;

    segmentEndHandledRef.current = false;
    drawingTriggerHandledRef.current = false;
    pendingDrawingIndexRef.current = (segment.drawings ?? []).filter((d) => d.videoTime <= targetTime).length;
    setClipPreviewSegmentIndex(segmentIndex);
    setIsClipPreviewFinished(false);
    setClipPreviewProgress(
      selectedClipSegments.slice(0, segmentIndex).reduce((total, clipSegment) => total + getClipSegmentDuration(clipSegment), 0) +
        Math.max(0, targetTime - segment.startTime)
    );

    if (targetSourcePath && targetSourcePath !== clipPreviewVideo?.path) {
      try {
        const nextVideo = await window.clipboardCoach.openVideoFromPath(targetSourcePath);
        setClipPreviewVideo(nextVideo);
        setClipPreviewError("");
        setPendingClipPreviewPlay(autoplay);
        setPendingClipPreviewStartTime(targetTime);
      } catch (error) {
        console.error("Clip segment source video missing:", targetSourcePath, error);
        setClipPreviewError("Source video missing - preview unavailable.");
        setIsClipPreviewPlaying(false);
      }
      return;
    }

    const player = clipPreviewRef.current;

    if (!player) {
      return;
    }

    player.currentTime = targetTime;

    if (!autoplay) {
      return;
    }

    try {
      await player.play();
      setIsClipPreviewPlaying(true);
    } catch (error) {
      console.error("Clip preview playback failed:", error);
      setClipPreviewError("Clip preview could not start.");
      setIsClipPreviewPlaying(false);
    }
  }

  function handleClipPreviewTimeUpdate() {
    const player = clipPreviewRef.current;
    const segment = selectedClipSegments[clipPreviewSegmentIndex];

    if (!player || !segment) {
      return;
    }

    const segmentElapsed = Math.min(getClipSegmentDuration(segment), Math.max(0, player.currentTime - segment.startTime));
    setClipPreviewProgress(Math.min(selectedClipDuration, currentSegmentOffset + segmentElapsed));

    const segmentDrawings = segment.drawings ?? [];
    const nextDrawing = segmentDrawings[pendingDrawingIndexRef.current];

    if (nextDrawing && player.currentTime >= nextDrawing.videoTime - 0.1 && !drawingTriggerHandledRef.current) {
      drawingTriggerHandledRef.current = true;
      pendingDrawingIndexRef.current += 1;
      player.pause();
      player.currentTime = nextDrawing.videoTime;
      setIsClipPreviewPlaying(false);
      setDrawingPlayback({ drawing: nextDrawing, startedAt: Date.now() });
      setDrawingElapsedMs(0);
      return;
    }

    if (player.currentTime < segment.endTime) {
      return;
    }

    if (segmentEndHandledRef.current) {
      return;
    }

    segmentEndHandledRef.current = true;
    player.pause();

    const nextSegmentIndex = clipPreviewSegmentIndex + 1;

    if (nextSegmentIndex < selectedClipSegments.length) {
      void playClipSegment(nextSegmentIndex);
      return;
    }

    setClipPreviewProgress(selectedClipDuration);
    setIsClipPreviewPlaying(false);
    setIsClipPreviewFinished(true);
  }

  async function openClipSourceVideo(clip: ClipRecord) {
    const segment = currentClipSegment ?? selectedClipSegments[0] ?? null;
    const segmentSourcePath = segment?.sourceVideoPath ?? clip.sourceVideoPath;

    if (!segmentSourcePath || clip.missingSourceVideo || !segment) {
      setClipPreviewError("Source video missing - cannot open.");
      return;
    }

    const previewPlayer = clipPreviewRef.current;
    const previewTime = previewPlayer?.currentTime;
    const canUsePreviewTime =
      typeof previewTime === "number" && previewTime >= segment.startTime && previewTime <= segment.endTime;
    const targetTime = canUsePreviewTime ? previewTime : segment.startTime;

    setPendingSourceOpen({
      videoPath: segmentSourcePath,
      time: targetTime,
      tagId: segment.id,
      shouldPlay: isClipPreviewPlaying
    });
    setSelectedClipId(null);
    setScreen("video");
    await openPreviousVideo(segmentSourcePath);
  }

  function openClipsLibrary() {
    setSelectedClipId(null);
    setClipPreviewVideo(null);
    setClipPreviewError("");
    setClipPreviewProgress(0);
    setIsClipPreviewFinished(false);
    setIsClipPreviewPlaying(false);
    setScreen("clips");
  }

  function viewLastSavedClip() {
    if (!lastSavedClipId) {
      return;
    }

    openClipsLibrary();
    setSelectedClipId(lastSavedClipId);
  }

  function getSourceTimeForClipProgress(progress: number) {
    const safeProgress = Math.min(Math.max(progress, 0), selectedClipDuration);
    let elapsedBeforeSegment = 0;

    for (let index = 0; index < selectedClipSegments.length; index += 1) {
      const segment = selectedClipSegments[index];
      const segmentDuration = getClipSegmentDuration(segment);

      if (safeProgress <= elapsedBeforeSegment + segmentDuration || index === selectedClipSegments.length - 1) {
        return {
          segmentIndex: index,
          sourceTime: segment.startTime + Math.min(segmentDuration, Math.max(0, safeProgress - elapsedBeforeSegment))
        };
      }

      elapsedBeforeSegment += segmentDuration;
    }

    return null;
  }

  async function seekClipPreviewToProgress(progress: number, shouldPlay = isClipPreviewPlaying) {
    const mappedTime = getSourceTimeForClipProgress(progress);

    if (!mappedTime) {
      return;
    }

    setIsClipPreviewFinished(false);
    await playClipSegment(mappedTime.segmentIndex, { autoplay: shouldPlay, sourceTime: mappedTime.sourceTime });
  }

  async function toggleClipPreviewPlayback() {
    const player = clipPreviewRef.current;

    if (!player) {
      return;
    }

    if (isClipPreviewPlaying) {
      player.pause();
      setIsClipPreviewPlaying(false);
      return;
    }

    if (isClipPreviewFinished || selectedClipSegments.length === 0) {
      await playClipSegment(0);
      return;
    }

    await seekClipPreviewToProgress(clipPreviewProgress, true);
  }

  async function openClipPreviewFullscreen() {
    const container = clipPreviewFullscreenRef.current;

    if (!container?.requestFullscreen) {
      return;
    }

    await container.requestFullscreen();
  }

  function renderHome() {
    return (
      <main className="homeShell">
        <section className="homeBanner" aria-label="Clipboard Coach Studio">
          <img src={homeBannerUrl} alt="Clipboard Coach Studio" />
        </section>

        <section className="homeCards" aria-label="Start page navigation">
          <button
            type="button"
            className="homeCard"
            onClick={() => setScreen("teams")}
            aria-label="Open Teams"
            title="Teams"
          >
            <img src={homeTeamsUrl} alt="" />
          </button>
          <button
            type="button"
            className="homeCard"
            onClick={() => {
              setMatchModalMode("select");
              setIsMatchModalOpen(true);
            }}
            aria-label="Open Video Viewer"
            title="Video Viewer"
          >
            <img src={homeVideoViewerUrl} alt="" />
          </button>
          <button
            type="button"
            className="homeCard"
            onClick={openClipsLibrary}
            aria-label="Open Clips"
            title="Clips"
          >
            <img src={homeClipsUrl} alt="" />
          </button>
          <button
            type="button"
            className="homeCard"
            onClick={() => setScreen("tracking")}
            aria-label="Open Players Tracking"
            title="Players Tracking"
          >
            <img src={homeTrackingUrl} alt="" />
          </button>
          <button
            type="button"
            className="homeCard"
            onClick={() => setScreen("settings")}
            aria-label="Open Settings"
            title="Settings"
          >
            <img src={homeSettingsUrl} alt="" />
          </button>
          <button
            type="button"
            className="homeCard"
            onClick={() => void window.clipboardCoach.quitApp()}
            aria-label="Afsluiten"
            title="Afsluiten"
          >
            <img src={homeExitUrl} alt="" />
          </button>
        </section>
      </main>
    );
  }

  function getPlayerInitials(player: Player): string {
    const f = player.firstName?.[0] ?? "";
    const l = player.lastName?.[0] ?? "";
    return (f + l).toUpperCase() || "?";
  }

  function renderPlayerDetail() {
    if (!selectedPlayerProfile) return null;
    const team = store.teams.find((t) => t.id === selectedPlayerProfile.teamId);
    const player = team?.players.find((p) => p.id === selectedPlayerProfile.playerId);
    if (!team || !player) return null;
    const playerClips = store.clips.filter((clip) => isClipLinkedToPlayer(clip, team, player));
    const playerMatches = getPlayerMatchSummaries(store, team, player);

    const goBack = () => { setSelectedPlayerProfile(null); setEditingPlayerId(null); };

    return (
      <main className="sectionShell">
        {/* ── Header ── */}
        <div className="playerDetailHeader">
          {/* left: nav buttons */}
          <div className="playerDetailHeaderNav">
            <button type="button" className="playerNavBtn" onClick={goBack} title="Back to Teams">
              <img src={navBackUrl} alt="Back" />
            </button>
            <button type="button" className="playerNavBtn" onClick={() => { goBack(); setScreen("home"); }} title="Home">
              <img src={navHomeUrl} alt="Home" />
            </button>
          </div>

          {/* center: avatar + name */}
          <div className="playerDetailHeaderInfo">
            <div className="playerDetailHeaderAvatar">{getPlayerInitials(player)}</div>
            <div>
              <h1 className="playerDetailName">{formatPlayerName(player)}</h1>
              <p className="playerDetailSub">{team.name}{player.email ? ` · ${player.email}` : ""}</p>
            </div>
          </div>

          {/* right: edit / delete */}
          <div className="playerDetailHeaderActions">
            {editingPlayerId === player.id ? (
              <div className="playerDetailEditForm">
                <input value={playerEditDraft.firstName} onChange={(e) => setPlayerEditDraft((c) => ({ ...c, firstName: e.target.value }))} placeholder="First name" />
                <input value={playerEditDraft.lastName} onChange={(e) => setPlayerEditDraft((c) => ({ ...c, lastName: e.target.value }))} placeholder="Last name" />
                <input value={playerEditDraft.email} onChange={(e) => setPlayerEditDraft((c) => ({ ...c, email: e.target.value }))} placeholder="Email" />
                <div className="playerDetailEditBtns">
                  <button type="button" onClick={() => setEditingPlayerId(null)}>Cancel</button>
                  <button type="button" className="primaryButton" onClick={() => savePlayerEdit(team.id, player.id)}>Save</button>
                </div>
              </div>
            ) : (
              <div className="playerDetailBtnRow">
                <button type="button" className="secondaryButton" onClick={() => startEditingPlayer(player)}>Edit</button>
                <button type="button" className="dangerButton" onClick={() => { deletePlayer(team.id, player.id); goBack(); }}>Delete</button>
              </div>
            )}
          </div>
        </div>

        {/* All sections below live inside one wrapper so they occupy a
            single grid row of .sectionShell's `auto minmax(0, 1fr)` track
            layout - as siblings, only the first would land in the 1fr row
            (stretching to fill the viewport) while the rest got pushed
            below it, showing a large gap then everything bunched at the
            bottom. */}
        <div className="playerDetailBody">
        {/* ── Gespeelde wedstrijden ── */}
        <section className="playerDetailSection">
          <h2 className="playerDetailSectionTitle">
            <span>Gespeelde wedstrijden</span>
            <span className="playerDetailSectionCount">{playerMatches.length}</span>
          </h2>
          {playerMatches.length === 0 && (
            <p className="playerDetailEmptyHint">Nog niet getagd of getrackt in een wedstrijd.</p>
          )}
          {playerMatches.map(({ match, clips, blocks, totalDistanceMeters, totalDurationHours }) => (
            <details key={match.id} className="videoInfoDetails">
              <summary>
                {match.teamAName} - {match.teamBName} · Datum: {new Date(match.date).toLocaleDateString("nl-BE")}
              </summary>

              {clips.length > 0 && (
                <div className="playerClipGrid">
                  {clips.map((clip) => (
                    <button key={clip.id} type="button" className="playerClipCard" onClick={() => openClipDetails(clip.id)}>
                      <div className="playerClipIcon">▶</div>
                      <span className="playerClipName">{clip.name}</span>
                      <span className="playerClipMeta">{new Date(clip.createdAt).toLocaleDateString("nl-BE")}</span>
                    </button>
                  ))}
                </div>
              )}

              {blocks.length > 0 && (
                <ul className="playerMatchBlockList">
                  {blocks.map(({ video, blockLabel, distanceMeters, durationHours }) => {
                    const speed = formatAverageSpeedKmh(distanceMeters, durationHours);
                    return (
                      <li key={video.path}>
                        {blockLabel}: {formatDistanceKm(distanceMeters)}
                        {speed && ` (${speed})`}
                      </li>
                    );
                  })}
                  <li>
                    Total: {formatDistanceKm(totalDistanceMeters)}
                    {(() => {
                      const totalSpeed = formatAverageSpeedKmh(totalDistanceMeters, totalDurationHours);
                      return totalSpeed && ` (${totalSpeed})`;
                    })()}
                  </li>
                </ul>
              )}

              {blocks.length > 0 && (
                <div className="playerHeatmapGrid">
                  {blocks.map(({ video, blockLabel, points, pitchDimensions, backgroundStyle, distanceMeters, durationHours }) => {
                    const speed = formatAverageSpeedKmh(distanceMeters, durationHours);
                    return (
                      <div key={video.path} className="playerHeatmapCard">
                        <span className="playerHeatmapCardLabel">
                          {blockLabel} — {formatDistanceKm(distanceMeters)}
                          {speed ? ` (${speed})` : ""}
                        </span>
                        <PlayerHeatmap points={points ?? []} pitchDimensions={pitchDimensions} backgroundStyle={backgroundStyle} />
                      </div>
                    );
                  })}
                  <div className="playerHeatmapCard">
                    <span className="playerHeatmapCardLabel">
                      Totaal
                      {(() => {
                        const totalSpeed = formatAverageSpeedKmh(totalDistanceMeters, totalDurationHours);
                        return ` — ${formatDistanceKm(totalDistanceMeters)}${totalSpeed ? ` (${totalSpeed})` : ""}`;
                      })()}
                    </span>
                    <PlayerHeatmap
                      points={blocks.flatMap(({ points }) => points ?? [])}
                      pitchDimensions={blocks.find((b) => b.pitchDimensions)?.pitchDimensions ?? null}
                      backgroundStyle={blocks.find((b) => b.pitchDimensions)?.backgroundStyle ?? "image"}
                    />
                  </div>
                </div>
              )}
            </details>
          ))}
        </section>

        {/* ── Clips ── */}
        <section className="playerDetailSection">
          <h2 className="playerDetailSectionTitle">
            <span>Clips</span>
            <span className="playerDetailSectionCount">{playerClips.length}</span>
          </h2>
          <div className="playerClipGrid">
            {playerClips.map((clip) => (
              <button key={clip.id} type="button" className="playerClipCard" onClick={() => openClipDetails(clip.id)}>
                <div className="playerClipIcon">▶</div>
                <span className="playerClipName">{clip.name}</span>
                <span className="playerClipMeta">{new Date(clip.createdAt).toLocaleDateString("nl-BE")}</span>
              </button>
            ))}
            {playerClips.length === 0 && (
              <>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="playerClipCard playerClipCardEmpty">
                    <div className="playerClipIcon playerClipIconEmpty">▶</div>
                    <span className="playerClipName playerClipNameEmpty">Geen clip</span>
                    <span className="playerClipMeta">—</span>
                  </div>
                ))}
              </>
            )}
          </div>
          {playerClips.length === 0 && (
            <p className="playerDetailEmptyHint">Koppel clips aan deze speler via Video Viewer.</p>
          )}
        </section>

        {/* ── PDF-rapporten ── */}
        <section className="playerDetailSection">
          <h2 className="playerDetailSectionTitle">
            <span>PDF-rapporten</span>
            <span className="playerDetailSectionCount">0</span>
          </h2>
          <div className="playerClipGrid">
            {[0, 1].map((i) => (
              <div key={i} className="playerClipCard playerClipCardEmpty">
                <div className="playerClipIcon playerClipIconEmpty">📄</div>
                <span className="playerClipName playerClipNameEmpty">Geen rapport</span>
                <span className="playerClipMeta">—</span>
              </div>
            ))}
          </div>
          <p className="playerDetailEmptyHint">Rapporten komen binnenkort beschikbaar.</p>
        </section>
        </div>

        {renderClipDetailsModal()}
      </main>
    );
  }

  function renderTeams() {
    if (selectedPlayerProfile) {
      return renderPlayerDetail();
    }

    return (
      <main className="sectionShell">
        <Header
          title={selectedTeam?.name ?? "Teams"}
          subtitle=""
          onBack={() => setScreen("home")}
          visualSrc={homeTeamsUrl}
        />

        {store.teams.length > 0 ? (
          <nav className="teamTabs" aria-label="Kies een spelerslijst">
            {store.teams.map((team) => (
              <button
                key={team.id}
                type="button"
                className={team.id === selectedTeam?.id ? "active" : ""}
                aria-current={team.id === selectedTeam?.id ? "page" : undefined}
                onClick={() => selectTeam(team.id)}
              >
                {team.name}
              </button>
            ))}
          </nav>
        ) : null}

        <section className="teamsGrid">
          {store.teams.length === 0 ? <div className="emptyPanel">Nog geen teams. Maak een team aan.</div> : null}
          {selectedTeam ? [selectedTeam].map((team) => (
            <article className="teamCard" key={team.id}>
              <div className="teamCardHeader">
                {editingTeamId === team.id ? (
                  <div className="inlineTeamEdit">
                    <input value={teamNameDraft} onChange={(e) => setTeamNameDraft(e.target.value)} />
                    <button type="button" onClick={() => saveTeamName(team.id)}>Opslaan</button>
                    <button type="button" onClick={() => setEditingTeamId(null)}>Annuleer</button>
                  </div>
                ) : (
                  <>
                    <div className="teamCardTitle">
                      <strong>{team.name}</strong>
                      <small>{team.players.filter((p) => p.role !== "staff").length} players · {team.players.filter((p) => p.role === "staff").length} staff</small>
                    </div>
                    <div className="teamCardActions">
                      <button type="button" onClick={() => { setEditingTeamId(team.id); setTeamNameDraft(team.name); }}>Edit</button>
                      <button type="button" onClick={() => deleteTeam(team.id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
              {(() => {
                const players = getSortedPlayers(team.players.filter((p) => p.role !== "staff"));
                const staff = getSortedPlayers(team.players.filter((p) => p.role === "staff"));
                const renderCard = (player: Player) => {
                  const clipCount = store.clips.filter((clip) => isClipLinkedToPlayer(clip, team, player)).length;
                  return (
                    <button
                      key={player.id}
                      type="button"
                      className="playerCard"
                      onClick={() => setSelectedPlayerProfile({ teamId: team.id, playerId: player.id })}
                    >
                      <div className="playerCardAvatar">{getPlayerInitials(player)}</div>
                      <span className="playerCardName">{formatPlayerName(player)}</span>
                      <span className="playerCardMeta">{clipCount} clip{clipCount !== 1 ? "s" : ""}</span>
                    </button>
                  );
                };
                return (
                  <>
                    <div className="playerCardGrid">
                      {players.map(renderCard)}
                      <button
                        type="button"
                        className="playerCardAdd"
                        onClick={() => { setAddPlayerModalTeamId(team.id); setAddPlayerDraft({ firstName: "", lastName: "", email: "", role: "player" }); }}
                        title="Add player"
                      >
                        <span className="playerCardAddIcon">＋</span>
                        <span className="playerCardAddLabel">Add player</span>
                      </button>
                    </div>
                    <div className="staffSection">
                      <div className="staffSectionHeader">
                        <span>Staff</span>
                      </div>
                      <div className="playerCardGrid">
                        {staff.map(renderCard)}
                        <button
                          type="button"
                          className="playerCardAdd"
                          onClick={() => { setAddPlayerModalTeamId(team.id); setAddPlayerDraft({ firstName: "", lastName: "", email: "", role: "staff" }); }}
                          title="Add staff"
                        >
                          <span className="playerCardAddIcon">＋</span>
                          <span className="playerCardAddLabel">Add staff</span>
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </article>
          )) : null}
        </section>

        <div className="bottomActionRow">
          <button className="primaryButton" type="button" onClick={() => setIsCreateTeamModalOpen(true)}>
            Create Team
          </button>
        </div>

        {isCreateTeamModalOpen ? (
          <div className="modalBackdrop" role="presentation">
            <form className="teamCreateModal" onSubmit={createTeamWithPlayers} role="dialog" aria-modal="true" aria-label="Create team">
              <div className="cardHeader">
                <div>
                  <h2>Create Team</h2>
                  <p>Create a team and its players together.</p>
                </div>
                <button type="button" onClick={() => setIsCreateTeamModalOpen(false)}>Close</button>
              </div>
              <label>
                Teamnaam
                <input
                  value={createTeamDraft.name}
                  onChange={(e) => setCreateTeamDraft((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Team name"
                />
              </label>
              <div className="teamPlayerRows">
                {createTeamDraft.players.map((player, index) => (
                  <div className="teamPlayerRow" key={index}>
                    <input value={player.firstName} onChange={(e) => updateCreateTeamPlayer(index, "firstName", e.target.value)} placeholder="Voornaam" aria-label={`Voornaam speler ${index + 1}`} />
                    <input value={player.lastName} onChange={(e) => updateCreateTeamPlayer(index, "lastName", e.target.value)} placeholder="Naam" aria-label={`Naam speler ${index + 1}`} />
                    <input value={player.email} onChange={(e) => updateCreateTeamPlayer(index, "email", e.target.value)} placeholder="Email" aria-label={`Email speler ${index + 1}`} />
                  </div>
                ))}
              </div>
              <button type="button" onClick={addCreateTeamPlayerRow}>Add Player</button>
              <div className="modalActions">
                <button type="button" onClick={() => setIsCreateTeamModalOpen(false)}>Cancel</button>
                <button className="primaryButton" type="submit">Create</button>
              </div>
            </form>
          </div>
        ) : null}

        {addPlayerModalTeamId ? (
          <div className="modalBackdrop" role="presentation">
            <div className="teamCreateModal" role="dialog" aria-modal="true" aria-label="Add player">
              <div className="cardHeader">
                <div>
                  <h2>Add {addPlayerDraft.role === "staff" ? "Staff" : "Player"}</h2>
                  <p>{store.teams.find((t) => t.id === addPlayerModalTeamId)?.name}</p>
                </div>
                <button type="button" onClick={() => setAddPlayerModalTeamId(null)}>Close</button>
              </div>
              <div className="teamPlayerRow">
                <input
                  value={addPlayerDraft.firstName}
                  onChange={(e) => setAddPlayerDraft((c) => ({ ...c, firstName: e.target.value }))}
                  placeholder="First name"
                  autoFocus
                />
                <input
                  value={addPlayerDraft.lastName}
                  onChange={(e) => setAddPlayerDraft((c) => ({ ...c, lastName: e.target.value }))}
                  placeholder="Last name"
                />
                <input
                  value={addPlayerDraft.email}
                  onChange={(e) => setAddPlayerDraft((c) => ({ ...c, email: e.target.value }))}
                  placeholder="Email"
                />
              </div>
              <div className="modalActions">
                <button type="button" onClick={() => setAddPlayerModalTeamId(null)}>Cancel</button>
                <button type="button" className="primaryButton" onClick={() => void saveAddPlayer(addPlayerModalTeamId)}>Add</button>
              </div>
            </div>
          </div>
        ) : null}

        {renderClipDetailsModal()}
      </main>
    );
  }

  function renderClipDetailsModal() {
    if (!selectedClip) {
      return null;
    }

    return (
      <div className="modalBackdrop" role="presentation">
            <section className="clipDetailsModal" role="dialog" aria-modal="true" aria-label="Clip details">
              <div className="cardHeader">
                <div>
                  <h2>{selectedClip.name}</h2>
                  <p>{getClipMatchTitle(selectedClip, store.videos)}</p>
                </div>
                <button type="button" onClick={() => setSelectedClipId(null)}>
                  Close
                </button>
              </div>
              {isEditingClipName ? (
                <form className="clipRenameForm" onSubmit={renameSelectedClip}>
                  <input
                    value={clipRenameText}
                    onChange={(event) => setClipRenameText(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    aria-label="Clip name"
                    autoFocus
                  />
                  <button type="submit">Save</button>
                  <button
                    type="button"
                    onClick={() => {
                      setClipRenameText(selectedClip.name);
                      setIsEditingClipName(false);
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="clipRenameForm">
                  <span>{selectedClip.name}</span>
                  <button type="button" onClick={() => setIsEditingClipName(true)}>
                    Edit Name
                  </button>
                </div>
              )}
              <section className="clipPreviewPanel">
                <h3>Preview</h3>
                {clipPreviewError || selectedClip.missingSourceVideo ? (
                  <div className="warningMessage">Source video missing - preview unavailable.</div>
                ) : null}
                {clipPreviewVideo && !clipPreviewError && !selectedClip.missingSourceVideo ? (
                  <div className="clipPreviewFullscreenWrap" ref={clipPreviewFullscreenRef}>
                    <div className="clipPreviewStage">
                      <div className="clipPreviewVideoWrap">
                        <video
                          key={clipPreviewVideo.url}
                          ref={clipPreviewRef}
                          className="clipPreviewVideo"
                          src={clipPreviewVideo.url}
                          preload="metadata"
                          onLoadedMetadata={() => {
                            const player = clipPreviewRef.current;

                            if (player) {
                              if (pendingClipPreviewStartTime !== null) {
                                player.currentTime = pendingClipPreviewStartTime;
                                setPendingClipPreviewStartTime(null);
                              } else if (currentClipSegment) {
                                player.currentTime = currentClipSegment.startTime;
                              }
                            }

                            if (pendingClipPreviewPlay && player) {
                              setPendingClipPreviewPlay(false);
                              player
                                .play()
                                .then(() => setIsClipPreviewPlaying(true))
                                .catch((error) => {
                                  console.error("Clip preview playback failed:", error);
                                  setClipPreviewError("Clip preview could not start.");
                                  setIsClipPreviewPlaying(false);
                                });
                            }
                          }}
                          onTimeUpdate={handleClipPreviewTimeUpdate}
                          onPause={() => setIsClipPreviewPlaying(false)}
                          onPlay={() => setIsClipPreviewPlaying(true)}
                        />
                        {drawingPlayback ? (
                          <div className="clipDrawingOverlay">
                            <img src={drawingPlayback.drawing.dataUrl} alt="Tekening" className="clipDrawingImage" />
                            <div className="clipDrawingCountdown">
                              {Math.max(0, Math.ceil(drawingPlayback.drawing.durationSeconds - drawingElapsedMs / 1000))}s
                            </div>
                          </div>
                        ) : null}
                        {!isClipPreviewPlaying && !drawingPlayback ? (
                          <button
                            className="clipPlayOverlay"
                            type="button"
                            onClick={toggleClipPreviewPlayback}
                            aria-label={isClipPreviewFinished ? "Replay clip preview" : "Play clip preview"}
                          >
                            ▶
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="clipPreviewControls">
                      <button type="button" onClick={toggleClipPreviewPlayback} disabled={selectedClipSegments.length === 0}>
                        {isClipPreviewFinished ? "Replay Preview" : isClipPreviewPlaying ? "Pause Preview" : "Play Preview"}
                      </button>
                      <span>
                        {formatPreciseClockTime(clipPreviewProgress)} / {formatPreciseClockTime(selectedClipDuration)}
                      </span>
                      <TimelineSlider
                        max={selectedClipDuration || 0}
                        value={Math.min(clipPreviewProgress, selectedClipDuration || 0)}
                        disabled={selectedClipSegments.length === 0}
                        label="Clip preview timeline"
                        onChange={(nextValue) => seekClipPreviewToProgress(nextValue, false)}
                      />
                      <button type="button" onClick={openClipPreviewFullscreen} disabled={!clipPreviewVideo}>
                        Fullscreen
                      </button>
                      {isClipPreviewFinished ? <strong>Preview finished</strong> : null}
                      {currentClipSegment ? (
                        <small>
                          Segment: {currentClipSegment.label} | Source {formatClockTime(currentClipSegment.startTime)} -{" "}
                          {formatClockTime(currentClipSegment.endTime)}
                        </small>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>
              <section className="clipTagList">
                <h3>Segments</h3>
                {selectedClipSegments.length === 0 ? <p>No tag snapshots saved.</p> : null}
                {selectedClipSegments.map((tag, index) => (
                  <button
                    className={index === clipPreviewSegmentIndex ? "clipSegmentButton activeClipSegment" : "clipSegmentButton"}
                    type="button"
                    key={tag.id}
                    onClick={() => playClipSegment(index)}
                  >
                    <strong>{tag.label}</strong>
                    <span>
                      {formatClockTime(tag.startTime)} - {formatClockTime(tag.endTime)}
                    </span>
                    {getTagPlayerNames(tag).length > 0 ? <small>Players: {getTagPlayerNames(tag).join(", ")}</small> : null}
                  </button>
                ))}
              </section>
              <div className="modalActions">
                <button
                  type="button"
                  onClick={() => openClipSourceVideo(selectedClip)}
                  disabled={!selectedClip.sourceVideoPath || !!selectedClip.missingSourceVideo || selectedClipSegments.length === 0}
                >
                  {selectedClip.missingSourceVideo ? "Source video missing - cannot open" : "Open Source Video"}
                </button>
                <button
                  type="button"
                  onClick={exportSelectedClip}
                  disabled={
                    !!exportingClipId ||
                    !!selectedClip.missingSourceVideo ||
                    selectedClipSegments.length === 0
                  }
                >
                  {exportingClipId === selectedClip.id
                    ? `Exporting... ${Math.round(exportProgress * 100)}%`
                    : selectedClip.exportStatus === "exported"
                      ? "Re-export Clip"
                      : "Export Clip"}
                </button>
                <button
                  type="button"
                  onClick={saveSelectedClipAs}
                  disabled={!selectedClip.localClipPath || selectedClip.exportStatus !== "exported" || isSavingClipAs}
                >
                  {isSavingClipAs ? "Saving..." : "Save As..."}
                </button>
                <button type="button" className="dangerButton" onClick={() => setPendingClipDeleteId(selectedClip.id)}>
                  Delete Clip
                </button>
              </div>
              {exportingClipId === selectedClip.id ? (
                <div className="exportProgressBar">
                  <div className="exportProgressFill" style={{ width: `${Math.round(exportProgress * 100)}%` }} />
                </div>
              ) : null}
              {exportError ? <div className="warningMessage">{exportError}</div> : null}
              <div className="clipMetaList">
                <span>Team: {getClipTeamLabel(selectedClip)}</span>
                <span>Sharing target: {getClipAudienceLabel(selectedClip)}</span>
                <label className="staffShareLabel">
                  <input
                    type="checkbox"
                    checked={selectedClip.shareWithStaff ?? false}
                    disabled={!getClipTeamId(selectedClip)}
                    onChange={() => void toggleClipShareWithStaff(selectedClip)}
                    style={{ width: "auto", minHeight: "auto" }}
                  />
                  Include Staff
                </label>
                <span>
                  Export status:{" "}
                  {selectedClip.exportStatus === "exported" && selectedClip.localClipPath
                    ? `Exported to ${shortenPath(selectedClip.localClipPath)}`
                    : "Preview only - no video file exported yet"}
                </span>
                <span>Upload status: {selectedClip.uploadStatus ?? "not_uploaded"}</span>
                <span>Share URL: {selectedClip.shareUrl ?? "Not created"}</span>
                <span>Created: {new Date(selectedClip.createdAt).toLocaleString()}</span>
              </div>
            </section>
          </div>
    );
  }

  function renderClips() {
    return (
      <main className="sectionShell">
        <Header title="Clips" subtitle="" onBack={() => setScreen("home")} visualSrc={homeClipsUrl} />
        <section className="clipGrid">
          {store.clips.length === 0 ? (
            <div className="emptyPanel">No clip records yet. Use Make Clip in the Video Viewer to prepare one.</div>
          ) : null}
          {store.clips.map((clip) => (
            <article className={clip.missingSourceVideo ? "clipCard missingSourceClip" : "clipCard"} key={clip.id}>
              <button type="button" className="clipCardButton" onClick={() => setSelectedClipId(clip.id)}>
                <h2>{clip.name}</h2>
                <p>{getClipMatchTitle(clip, store.videos)}</p>
              </button>
            </article>
          ))}
        </section>

        {renderClipDetailsModal()}
      </main>
    );
  }

  function renderSettings() {
    return (
      <main className="sectionShell">
        <Header
          title="Settings"
          subtitle=""
          onBack={() => setScreen("home")}
          visualSrc={homeSettingsUrl}
        />
        <section className="settingsGrid" aria-label="Settings sections">

          <article className="settingsPanel">
            <h2>Appearance</h2>
            <p>Choose a theme for Clipboard Coach Studio.</p>
            <div className="themeToggle">
              <button
                type="button"
                className={`themeBtn${appTheme === "dark" ? " themeBtnActive" : ""}`}
                onClick={() => void persistSettings({ theme: "dark" })}
              >
                <span className="themeBtnIcon">🌙</span>
                Dark
              </button>
              <button
                type="button"
                className={`themeBtn${appTheme === "light" ? " themeBtnActive" : ""}`}
                onClick={() => void persistSettings({ theme: "light" })}
              >
                <span className="themeBtnIcon">☀️</span>
                Light
              </button>
            </div>
          </article>

          <article className="settingsPanel">
            <h2>Player Names</h2>
            <p>Display order for player names throughout the app.</p>
            <label>
              Display order
              <select
                value={playerNameOrder}
                onChange={(event) =>
                  void persistSettings({ playerNameOrder: event.currentTarget.value as AppSettings["playerNameOrder"] })
                }
              >
                <option value="first_last">First name first</option>
                <option value="last_first">Last name first</option>
              </select>
            </label>
          </article>

          <article className="settingsPanel">
            <h2>Playback</h2>
            <p>Video review uses local files and the built-in desktop player.</p>
          </article>

          <article className="settingsPanel">
            <h2>Storage</h2>
            <p>Teams, videos, tags, and clip records are saved locally as JSON. No cloud, no subscription.</p>
          </article>

        </section>
      </main>
    );
  }

  function renderMatchCreateForm() {
    const hasSelectedVideo = newMatchDraft.videoSlots.some((slot) => slot !== null);
    const isCreatingWorkingCopy = !!workingCopyProgress && workingCopyProgress.stage !== "ready";

    return (
      <form className="matchModalForm" onSubmit={createMatch}>
        <section className="modalSection">
          <h3>Matchinfo</h3>
          <div className="modalFieldGrid">
            <label>
              Datum
              <input
                type="date"
                value={newMatchDraft.date}
                onChange={(event) => setNewMatchDraft((current) => ({ ...current, date: event.target.value }))}
              />
            </label>
            <label>
              Startuur
              <input
                type="time"
                value={newMatchDraft.startTime}
                onChange={(event) => setNewMatchDraft((current) => ({ ...current, startTime: event.target.value }))}
              />
            </label>
          </div>

          <div className="modalTeamGrid">
            <div className="teamChoiceBlock">
              <label>
                Team A
                <input
                  value={newMatchDraft.teamAName}
                  onChange={(event) =>
                    setNewMatchDraft((current) => ({ ...current, teamAName: event.target.value, teamAId: "" }))
                  }
                  placeholder="Team A"
                />
              </label>
              <select value={newMatchDraft.teamAId} onChange={(event) => chooseMatchTeam("A", event.target.value)} disabled={store.teams.length === 0}>
                <option value="">Kies bestaand team</option>
                {store.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {selectedTeamA ? (
                <div className="matchPlayerPickList">
                  <strong>Spelers Team A</strong>
                  {getSortedPlayers(selectedTeamA.players).map((player) => (
                    <label key={player.id}>
                      <input
                        type="checkbox"
                        checked={newMatchDraft.selectedTeamAPlayerIds.includes(player.id)}
                        onChange={() => toggleNewMatchPlayer("A", player.id)}
                      />
                      {formatPlayerName(player)}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="teamChoiceBlock">
              <label>
                Team B
                <input
                  value={newMatchDraft.teamBName}
                  onChange={(event) =>
                    setNewMatchDraft((current) => ({ ...current, teamBName: event.target.value, teamBId: "" }))
                  }
                  placeholder="Team B"
                />
              </label>
              <select value={newMatchDraft.teamBId} onChange={(event) => chooseMatchTeam("B", event.target.value)} disabled={store.teams.length === 0}>
                <option value="">Kies bestaand team</option>
                {store.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              {selectedTeamB ? (
                <div className="matchPlayerPickList">
                  <strong>Spelers Team B</strong>
                  {getSortedPlayers(selectedTeamB.players).map((player) => (
                    <label key={player.id}>
                      <input
                        type="checkbox"
                        checked={newMatchDraft.selectedTeamBPlayerIds.includes(player.id)}
                        onChange={() => toggleNewMatchPlayer("B", player.id)}
                      />
                      {formatPlayerName(player)}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="modalSection">
          <h3>Video</h3>
          <div className="matchVideoGrid" aria-label="Match videos">
            {newMatchDraft.videoSlots.map((slot, index) => (
              <button
                className="matchVideoTile"
                type="button"
                key={index}
                onClick={() => selectMatchVideoSlot(index)}
                disabled={isCreatingWorkingCopy}
              >
                <strong>{slot ? slot.name : "+"}</strong>
                <span>Video {index + 1} / Blok {index + 1}</span>
              </button>
            ))}
          </div>
          {isCreatingWorkingCopy ? (
            <div className="warningMessage">
              Creating compatible working copy... {Math.round((workingCopyProgress?.progress ?? 0) * 100)}%
            </div>
          ) : null}
          <button type="button" onClick={addMatchVideoSlot} disabled={isCreatingWorkingCopy}>
            Add More Videos
          </button>
        </section>

        <div className="modalActions">
          <button type="button" onClick={() => setMatchModalMode("select")}>
            Terug
          </button>
          <button className="primaryButton" type="submit" disabled={!hasSelectedVideo}>
            Maak match aan
          </button>
        </div>
      </form>
    );
  }

  function renderMatchModal() {
    if (!isMatchModalOpen) {
      return null;
    }

    return (
      <div className="modalBackdrop" role="presentation">
        <div className="matchStartModal" role="dialog" aria-modal="true" aria-label="Match start">
          <div className="cardHeader">
            <div>
              <h2>{matchModalMode === "create" ? "Nieuwe match" : matchModalMode === "view" ? "Matchinfo" : matchModalMode === "all" ? "Vorige wedstrijden" : "Video Viewer"}</h2>
              <p>Matches and videos stay saved locally.</p>
            </div>
            <div className="modalHeaderActions">
              {matchModalMode === "view" && activeMatch && !isEditingMatchInfo ? (
                <button type="button" onClick={() => setIsEditingMatchInfo(true)}>
                  Edit
                </button>
              ) : null}
              <button type="button" onClick={() => setIsMatchModalOpen(false)}>
                Close
              </button>
            </div>
          </div>

          {matchModalMode === "select" ? (
            <>
              <button className="primaryButton" type="button" onClick={() => setMatchModalMode("create")}>
                Nieuwe match aanmaken
              </button>
              <div className="recentMatchList">
                <strong>Laatste wedstrijden</strong>
                {[0, 1, 2].map((index) => {
                  const match = recentMatches[index];

                  return match ? (
                    <div className="recentMatchRow" key={match.id}>
                      <button type="button" onClick={() => openMatch(match.id)}>
                        {match.date || "Geen datum"}: {match.teamAName || "Team A"} - {match.teamBName || "Team B"}
                      </button>
                      <button
                        className="dangerIconButton"
                        type="button"
                        aria-label="Verwijder wedstrijd"
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteMatch(match.id);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  ) : (
                    <button className="recentMatchPlaceholder" type="button" key={index} disabled>
                      Geen recente wedstrijd
                    </button>
                  );
                })}
                <button type="button" onClick={() => setMatchModalMode("all")}>
                  Vorige wedstrijden
                </button>
              </div>
            </>
          ) : null}

          {matchModalMode === "create" ? renderMatchCreateForm() : null}

          {matchModalMode === "all" ? (
            <div className="recentMatchList">
              {store.matches.length === 0 ? <div className="emptyPanel">Geen opgeslagen wedstrijden.</div> : null}
              {[...store.matches]
                .sort((first, second) => {
                  const firstTime = new Date(first.lastOpenedAt ?? first.date ?? first.createdAt).getTime();
                  const secondTime = new Date(second.lastOpenedAt ?? second.date ?? second.createdAt).getTime();
                  return secondTime - firstTime;
                })
                .map((match) => (
                  <button type="button" key={match.id} onClick={() => openMatch(match.id)}>
                    {match.date || "Geen datum"}: {match.teamAName || "Team A"} - {match.teamBName || "Team B"}
                  </button>
                ))}
              <button type="button" onClick={() => setMatchModalMode("select")}>
                Terug
              </button>
            </div>
          ) : null}

          {matchModalMode === "view" && activeMatch ? (
            <div className="matchModalReadout">
              {isEditingMatchInfo ? (
                <>
                  <div><span>Datum</span><input type="date" value={matchEditDraft.date} onChange={(event) => setMatchEditDraft((current) => ({ ...current, date: event.target.value }))} /></div>
                  <div><span>Startuur</span><input type="time" value={matchEditDraft.startTime} onChange={(event) => setMatchEditDraft((current) => ({ ...current, startTime: event.target.value }))} /></div>
                  <div><span>Team A</span><input value={matchEditDraft.teamAName} onChange={(event) => setMatchEditDraft((current) => ({ ...current, teamAName: event.target.value }))} /></div>
                  <div><span>Team B</span><input value={matchEditDraft.teamBName} onChange={(event) => setMatchEditDraft((current) => ({ ...current, teamBName: event.target.value }))} /></div>
                  {activeMatch.teamAId ? (
                    <div className="matchEditPlayers">
                      <span>Spelers A</span>
                      <div>
                        {getSortedPlayers(store.teams.find((team) => team.id === activeMatch.teamAId)?.players ?? []).map((player) => (
                          <label key={player.id}>
                            <input
                              type="checkbox"
                              checked={matchEditDraft.selectedTeamAPlayerIds.includes(player.id)}
                              onChange={() =>
                                setMatchEditDraft((current) => ({
                                  ...current,
                                  selectedTeamAPlayerIds: current.selectedTeamAPlayerIds.includes(player.id)
                                    ? current.selectedTeamAPlayerIds.filter((playerId) => playerId !== player.id)
                                    : [...current.selectedTeamAPlayerIds, player.id]
                                }))
                              }
                            />
                            {formatPlayerName(player)}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {activeMatch.teamBId ? (
                    <div className="matchEditPlayers">
                      <span>Spelers B</span>
                      <div>
                        {getSortedPlayers(store.teams.find((team) => team.id === activeMatch.teamBId)?.players ?? []).map((player) => (
                          <label key={player.id}>
                            <input
                              type="checkbox"
                              checked={matchEditDraft.selectedTeamBPlayerIds.includes(player.id)}
                              onChange={() =>
                                setMatchEditDraft((current) => ({
                                  ...current,
                                  selectedTeamBPlayerIds: current.selectedTeamBPlayerIds.includes(player.id)
                                    ? current.selectedTeamBPlayerIds.filter((playerId) => playerId !== player.id)
                                    : [...current.selectedTeamBPlayerIds, player.id]
                                }))
                              }
                            />
                            {formatPlayerName(player)}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="modalActions">
                    <button type="button" onClick={() => setIsEditingMatchInfo(false)}>Cancel</button>
                    <button className="primaryButton" type="button" onClick={saveMatchInfoEdit}>Save</button>
                  </div>
                </>
              ) : (
                <>
                  <div><span>Datum</span><strong>{activeMatch.date || "Not set"}</strong></div>
                  <div><span>Startuur</span><strong>{activeMatch.startTime || "Not set"}</strong></div>
                  <div><span>Team A</span><strong>{activeMatch.teamAName || "Not set"}</strong></div>
                  <div><span>Team B</span><strong>{activeMatch.teamBName || "Not set"}</strong></div>
                  <div><span>Spelers A</span><strong>{getMatchPlayerNames(activeMatch.selectedTeamAPlayerIds).join(", ") || "Geen"}</strong></div>
                  <div><span>Spelers B</span><strong>{getMatchPlayerNames(activeMatch.selectedTeamBPlayerIds).join(", ") || "Geen"}</strong></div>
                  <div><span>Blokken</span><strong>{activeMatchVideos.map((storedVideo) => storedVideo.matchBlockLabel ?? storedVideo.name).join(", ") || "Geen"}</strong></div>
                  <div className="modalActions">
                    <button type="button" onClick={addVideoBlockToActiveMatch}>Video toevoegen als blok</button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderVideoViewer() {
    return (
      <main className="appShell">
        <aside className="controlPanel" aria-label="Basic controls">
          <div className="controlPanelHeader">
            <button type="button" className="playerNavBtn" onClick={() => setScreen("home")} title="Home">
              <img src={navHomeUrl} alt="Home" />
            </button>
            <div className="controlPanelTitle">
              <img src={homeVideoViewerUrl} alt="" className="controlPanelArtworkSmall" />
              <strong>Video Viewer</strong>
            </div>
          </div>

          <button type="button" onClick={openMatchInfoModal}>
            Match Info
          </button>

          <div className="transportDock" aria-label="Playback controls">
            <button type="button" onClick={() => seekBy(-5)} disabled={!video}>
              &lt;
            </button>
            <button type="button" onClick={isPlaying ? pauseVideo : playVideo} disabled={!video || !!videoError}>
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button type="button" onClick={speedUp} disabled={!video}>
              &gt;&gt;
            </button>
            <span>{playbackRate}x</span>
          </div>
          <button type="button" onClick={() => markBlockBoundary("start")} disabled={!video}>
            Mark Block Start
          </button>
          <button type="button" onClick={() => markBlockBoundary("end")} disabled={!video}>
            Mark Block End
          </button>

          {activeMatch ? (
            <section className="activeMatchPanel" aria-label="Active match">
              <button className="matchInfoCardButton" type="button" onClick={openMatchInfoModal}>
                <strong>
                  {activeMatch.teamAName || "Team A"} - {activeMatch.teamBName || "Team B"}
                </strong>
                <span>{[activeMatch.date, activeMatch.startTime].filter(Boolean).join(" - ")}</span>
                <span>
                  Players: {activeMatch.selectedTeamAPlayerIds.length + activeMatch.selectedTeamBPlayerIds.length}
                </span>
              </button>
            </section>
          ) : null}

          <section className="standardTagPanel" aria-label="Standard tags">
            <div className="panelTitleRow">
              <button className="sectionTitleButton" type="button" onClick={() => setIsStandardTagsModalOpen(true)}>
                Standard Tags
              </button>
              <button type="button" onClick={openAddTagModal} disabled={!video}>
                Add Tag
              </button>
            </div>
            <div className="standardTagButtons quickTagButtons">
              {standardTags.map((tagName) => (
                <button type="button" key={tagName} disabled={!video} onClick={() => createTagAtCurrentTime(tagName)}>
                  {tagName}
                </button>
              ))}
            </div>
          </section>

          {video ? (
            <details className="videoInfoDetails" open={isVideoInfoOpen} onToggle={(event) => setIsVideoInfoOpen(event.currentTarget.open)}>
              <summary>Video Info</summary>
              <div className="videoDetails" aria-label="Selected video details">
                <div>
                  <span>File</span>
                  <strong>{video.name}</strong>
                </div>
                <div>
                  <span>Path</span>
                  <code title={video.path}>{shortenPath(video.path)}</code>
                </div>
                <div>
                  <span>Tags</span>
                  <strong>{currentVideoRecord?.tags.length ?? tags.length}</strong>
                </div>
                {activeMatch ? (
                  <>
                    <div>
                      <span>Block</span>
                      <strong>{currentVideoRecord?.matchBlockNumber ?? "Not set"}</strong>
                    </div>
                    <div>
                      <span>Label</span>
                      <strong>{currentVideoRecord?.matchBlockLabel ?? "Not set"}</strong>
                    </div>
                    <div>
                      <span>Minute</span>
                      <strong>{currentVideoRecord?.matchBlockStartMinute ?? "Not set"}</strong>
                    </div>
                  </>
                ) : null}
                <div>
                  <span>Start</span>
                  <strong>{kickoffVideoOffset === null ? "Not set" : formatClockTime(kickoffVideoOffset)}</strong>
                </div>
                <div>
                  <span>End</span>
                  <strong>{blockEndVideoOffset === null ? "Not set" : formatClockTime(blockEndVideoOffset)}</strong>
                </div>
              </div>
            </details>
          ) : null}

          {supportWarning ? <div className="warningMessage">{supportWarning}</div> : null}
          {videoError ? <div className="errorMessage">{videoError}</div> : null}

          <p className="statusLine" role="status">
            {status}
          </p>
          {lastSavedClipId ? (
            <button type="button" onClick={viewLastSavedClip}>
              View saved clip
            </button>
          ) : null}
        </aside>

        <section className="videoPanel" aria-label="Video player">
          {video ? (
            <div
              className="videoStage"
              onWheel={(event: ReactWheelEvent<HTMLDivElement>) => {
                event.preventDefault();
                if ((event.deltaY < 0 && videoZoom >= 4) || (event.deltaY >= 0 && videoZoom <= 1)) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                setVideoZoomOrigin({
                  x: ((event.clientX - bounds.left) / bounds.width) * 100,
                  y: ((event.clientY - bounds.top) / bounds.height) * 100
                });
                setVideoZoom((current) => {
                  const next = Math.min(4, Math.max(1, current + (event.deltaY < 0 ? 0.25 : -0.25)));
                  if (next === 1) {
                    videoPanRef.current = { x: 0, y: 0 };
                    setVideoPan({ x: 0, y: 0 });
                  }
                  return next;
                });
              }}
              onPointerDown={(event) => {
                if (videoZoom <= 1 || event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                videoDragStartRef.current = {
                  pointerX: event.clientX,
                  pointerY: event.clientY,
                  panX: videoPanRef.current.x,
                  panY: videoPanRef.current.y
                };
                setIsVideoDragging(true);
              }}
              onPointerMove={(event) => {
                if (!isVideoDragging) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                const limitX = (bounds.width * (videoZoom - 1)) / 2;
                const limitY = (bounds.height * (videoZoom - 1)) / 2;
                videoPanRef.current = {
                  x: Math.min(limitX, Math.max(-limitX, videoDragStartRef.current.panX + event.clientX - videoDragStartRef.current.pointerX)),
                  y: Math.min(limitY, Math.max(-limitY, videoDragStartRef.current.panY + event.clientY - videoDragStartRef.current.pointerY))
                };
                if (videoDragFrameRef.current === null) {
                  videoDragFrameRef.current = requestAnimationFrame(() => {
                    videoDragFrameRef.current = null;
                    if (videoRef.current) {
                      videoRef.current.style.transform = `translate(${videoPanRef.current.x}px, ${videoPanRef.current.y}px) scale(${videoZoom})`;
                    }
                  });
                }
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                setVideoPan(videoPanRef.current);
                setIsVideoDragging(false);
              }}
              onPointerCancel={() => setIsVideoDragging(false)}
              data-dragging={isVideoDragging || undefined}
            >
              <video
                key={`${video.url}:${currentVideoKey ?? video.path}`}
                ref={videoRef}
                className="videoPlayer"
                draggable={false}
                style={{
                  transform: `translate(${videoPan.x}px, ${videoPan.y}px) scale(${videoZoom})`,
                  transformOrigin: `${videoZoomOrigin.x}% ${videoZoomOrigin.y}%`
                }}
                src={video.url}
                crossOrigin="anonymous"
                preload="metadata"
                onCanPlay={() => {
                  setVideoReady(true);
                  setVideoError("");
                }}
                onLoadedMetadata={(event) => {
                  const nextDuration = event.currentTarget.duration || 0;
                  setVideoZoom(1);
                  setVideoZoomOrigin({ x: 50, y: 50 });
                  videoPanRef.current = { x: 0, y: 0 };
                  setVideoPan({ x: 0, y: 0 });
                  setIsVideoDragging(false);
                  const pendingTime =
                    pendingSourceOpen && currentVideoKey === pendingSourceOpen.videoPath
                      ? Math.min(Math.max(pendingSourceOpen.time, 0), nextDuration || pendingSourceOpen.time)
                      : null;

                  if (pendingTime !== null) {
                    event.currentTarget.currentTime = pendingTime;
                    setCurrentTime(pendingTime);
                    setPendingSourceOpen((current) =>
                      current?.videoPath === currentVideoKey ? { ...current, didSeek: true } : current
                    );

                    if (pendingSourceOpen?.shouldPlay) {
                      event.currentTarget
                        .play()
                        .then(() => setIsPlaying(true))
                        .catch((error) => {
                          console.error("Source video playback could not resume:", error);
                          setIsPlaying(false);
                        });
                    }
                  } else {
                    setCurrentTime(event.currentTarget.currentTime);
                  }

                  setDuration(nextDuration);
                  setStatus(`Video loaded: ${video.name}.`);
                }}
                onError={handleVideoError}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onRateChange={(event) => setPlaybackRate(event.currentTarget.playbackRate)}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                controls={false}
              />
              {videoZoom > 1 ? (
                <button
                  type="button"
                  className="videoZoomReset"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setVideoZoom(1);
                    setVideoZoomOrigin({ x: 50, y: 50 });
                    videoPanRef.current = { x: 0, y: 0 };
                    setVideoPan({ x: 0, y: 0 });
                  }}
                  title="Reset video zoom"
                >
                  {Math.round(videoZoom * 100)}% · Reset
                </button>
              ) : null}
              {activeTagNames.length > 0 ? (
                <div className="activeTagWatermark" aria-live="polite">
                  <span>Active</span>
                  <strong>{activeTagNames.join(", ")}</strong>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="emptyVideo">
              <strong>No video open</strong>
              <span>Open a new video or choose a previous video from the left.</span>
            </div>
          )}
        </section>

        <aside className="tagPanel" aria-label="Timestamped tags">
          <div className="panelHeader">
            <h2>Tags</h2>
            <div className="tagPanelActions">
              <button type="button" onClick={openClipBuilder} disabled={!video || visibleTagItems.length === 0}>
                Make Clip
              </button>
              <span>{visibleTagItems.length}</span>
            </div>
          </div>
          {drawingCaptureError ? <p className="fieldError">{drawingCaptureError}</p> : null}

          {activeMatch ? (
            <section className="matchTagPlayers" aria-label="Match players for tagging">
              <strong>Players for tags</strong>
              {selectedTeamAPlayers.length === 0 && selectedTeamBPlayers.length === 0 ? (
                <span>No players selected for this match</span>
              ) : null}
              {selectedTeamAPlayers.length > 0 ? (
                <div>
                  <span>{activeMatch.teamAName || "Team A"}</span>
                  <div className="quickTagButtons playerTagButtons">
                    {selectedTeamAPlayers.map((player) => (
                      <button type="button" key={player.id} disabled={!video} onClick={() => createTagAtCurrentTime(formatPlayerName(player), [player.id])}>
                        {formatPlayerName(player)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedTeamBPlayers.length > 0 ? (
                <div>
                  <span>{activeMatch.teamBName || "Team B"}</span>
                  <div className="quickTagButtons playerTagButtons">
                    {selectedTeamBPlayers.map((player) => (
                      <button type="button" key={player.id} disabled={!video} onClick={() => createTagAtCurrentTime(formatPlayerName(player), [player.id])}>
                        {formatPlayerName(player)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {visibleTagItems.length > 0 ? (
            <ol className="tagList">
              {visibleTagItems.map((item) => (
                <li key={item.selectionId}>
                  <div
                    className={[
                      "tagRow",
                      "compactMatchTagRow",
                      item.videoId === currentVideoKey ? "activeBlockTagRow" : "",
                      selectedTagIds.includes(item.selectionId) ? "selectedTag" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <button
                      className="selectCircle"
                      type="button"
                      aria-label={`Select ${item.tag.label}`}
                      aria-pressed={selectedTagIds.includes(item.selectionId)}
                      onClick={() => toggleTagSelection(item.selectionId)}
                    />
                    <button
                      className="matchTagJumpButton"
                      type="button"
                      onClick={() => jumpToMatchTag(item)}
                    >
                      <strong>{item.blockLabel}</strong>
                      <time>{formatClockTime(item.videoTime)}</time>
                      <span>{item.tag.label}</span>
                      <small>{getTagPlayerNames(item.tag).join(", ")}</small>
                    </button>
                    <div className="tagRowActions">
                      {item.videoId === currentVideoKey ? (
                        <>
                          <button type="button" onClick={() => captureFrameForDrawing(item.tag.id)}>
                            Draw
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTagId(editingTagId === item.tag.id ? null : item.tag.id);
                              setSelectedTagIds((current) =>
                                current.includes(item.selectionId) ? current : [item.selectionId, ...current]
                              );
                            }}
                          >
                            {editingTagId === item.tag.id ? "Close" : "Edit"}
                          </button>
                          <button type="button" onClick={() => deleteTag(item.tag.id)}>
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                    {item.videoId === currentVideoKey &&
                    editingTagId !== item.tag.id &&
                    (tagDrawings[item.tag.id]?.length ?? 0) > 0 ? (
                      <div className="drawingThumbnailRow">
                        {tagDrawings[item.tag.id].map((drawing) => (
                          <div key={drawing.id} className="drawingThumbnailWrap">
                            <button
                              type="button"
                              className="drawingThumbnail"
                              onClick={() => openExistingDrawing(item.tag.id, drawing.id)}
                              aria-label={`Open drawing ${formatClockTime(drawing.videoTime)}`}
                            >
                              <img src={drawing.thumbnailUrl} alt={`Drawing ${formatClockTime(drawing.videoTime)}`} />
                              <span
                                className="drawingThumbnailDuplicate"
                                role="button"
                                tabIndex={0}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  duplicateDrawing(item.tag.id, drawing.id);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.stopPropagation();
                                    duplicateDrawing(item.tag.id, drawing.id);
                                  }
                                }}
                              >
                                ⧉
                              </span>
                            </button>
                            <div className="drawingThumbnailDuration">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextDrawings = (tagDrawings[item.tag.id] ?? []).map((d) =>
                                    d.id === drawing.id ? { ...d, durationSeconds: Math.max(1, d.durationSeconds - 1) } : d
                                  );
                                  setTagDrawings((current) => ({ ...current, [item.tag.id]: nextDrawings }));
                                  void persistTagDrawingsToStore(item.tag.id, nextDrawings);
                                }}
                              >
                                −
                              </button>
                              <span>{drawing.durationSeconds}s</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextDrawings = (tagDrawings[item.tag.id] ?? []).map((d) =>
                                    d.id === drawing.id ? { ...d, durationSeconds: Math.min(30, d.durationSeconds + 1) } : d
                                  );
                                  setTagDrawings((current) => ({ ...current, [item.tag.id]: nextDrawings }));
                                  void persistTagDrawingsToStore(item.tag.id, nextDrawings);
                                }}
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              className="dangerButton drawingThumbnailDelete"
                              onClick={() => void deleteDrawingFrame(item.tag.id, drawing.id)}
                            >
                              Delete Picture
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {item.videoId === currentVideoKey && editingTagId === item.tag.id ? (
                      <div className="inlineTagDetails">
                          <div className="tagEditor inlineEditor">
                            <h3>Editing {item.tag.label}</h3>
                            <label>
                              Name
                              <input
                                value={tagDraft.label}
                                onChange={(event) => setTagDraft((current) => ({ ...current, label: event.target.value }))}
                              />
                            </label>
                            <label>
                              Start
                              <input
                                value={tagDraft.startTime}
                                onChange={(event) =>
                                  setTagDraft((current) => ({ ...current, startTime: event.target.value }))
                                }
                              />
                            </label>
                            <label>
                              End
                              <input
                                value={tagDraft.endTime}
                                onChange={(event) =>
                                  setTagDraft((current) => ({ ...current, endTime: event.target.value }))
                                }
                              />
                            </label>
                            <div className="editPlayerList">
                              <strong>Add Players</strong>
                              {getEditablePlayersForTag(item.tag).length === 0 ? (
                                <span>No players available from the active match, linked tag, or selected team.</span>
                              ) : null}
                              {getEditablePlayersForTag(item.tag).map((player) => (
                                <label key={player.id}>
                                  <input
                                    type="checkbox"
                                    checked={
                                      (editingTag?.playerIds ?? []).includes(player.id) ||
                                      (editingTag?.playerRefs ?? []).some((playerRef) => playerRef.id === player.id)
                                    }
                                    onChange={() => updateEditingTagPlayers(player.id)}
                                  />
                                  {formatPlayerName(player)}
                                </label>
                              ))}
                            </div>
                            <button type="button" onClick={saveSelectedTagDraft}>
                              Save Tag
                            </button>
                            {tagDraftError ? <p className="fieldError">{tagDraftError}</p> : null}
                          </div>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="emptyTags">Tags you add will appear here and reload for this video.</div>
          )}

        </aside>

        <section className="timelinePanel" aria-label="Video timeline">
          <div className="timelineTimes">
            <div className="timelineClockStack">
              <span>{formatTime(currentTime)}</span>
              {matchClock !== null ? <span>Match clock: {formatTime(matchClock)}</span> : null}
            </div>
            <strong>{video ? video.name : videoReady ? "Ready" : "No video selected"}</strong>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="timelineTrack">
            {activeMatchVideoBlocks.length > 1 && matchTimelineTotalMinutes > 0 ? (
              <div className="globalBlockTimeline" aria-label="Match block timeline">
                {activeMatchVideoBlocks.map(({ videoKey, storedVideo }, index) => {
                  const startMinute = storedVideo.matchBlockStartMinute ?? index * 20;
                  const width = Math.max(8, (20 / matchTimelineTotalMinutes) * 100);

                  return (
                    <button
                      className={currentVideoKey === videoKey ? "globalBlockSegment activeGlobalBlock" : "globalBlockSegment"}
                      type="button"
                      key={videoKey}
                      style={{
                        left: `${Math.min(100, Math.max(0, (startMinute / matchTimelineTotalMinutes) * 100))}%`,
                        width: `${Math.min(100, width)}%`
                      }}
                      onClick={() => openPreviousVideo(videoKey, activeMatch?.id)}
                    >
                      {storedVideo.matchBlockLabel ?? `Block ${storedVideo.matchBlockNumber ?? index + 1}`}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {duration > 0 && kickoffVideoOffset !== null ? (
              <button
                className="blockMarker blockStartMarker"
                type="button"
                style={{ left: `${Math.min(100, Math.max(0, (kickoffVideoOffset / duration) * 100))}%` }}
                title={`Block start: ${formatClockTime(kickoffVideoOffset)}`}
                aria-label={`Block start: ${formatClockTime(kickoffVideoOffset)}`}
                onClick={() => seekTo(kickoffVideoOffset)}
              >
                🚩
              </button>
            ) : null}
            {duration > 0 && blockEndVideoOffset !== null ? (
              <button
                className="blockMarker blockEndMarker"
                type="button"
                style={{ left: `${Math.min(100, Math.max(0, (blockEndVideoOffset / duration) * 100))}%` }}
                title={`Block end: ${formatClockTime(blockEndVideoOffset)}`}
                aria-label={`Block end: ${formatClockTime(blockEndVideoOffset)}`}
                onClick={() => seekTo(blockEndVideoOffset)}
              >
                🏁
              </button>
            ) : null}
            <div className="timelineTagLane">
              <div className="timelineTagLaneContent" style={{ height: `${Math.max(34, timelineLaneCount * 24 + 8)}px` }}>
                {duration > 0
                  ? timelineTags.map(({ tag, laneIndex, startTime, endTime }) => (
                    <button
                      key={tag.id}
                      className={selectedTagIds.includes(tag.id) ? "tagBlock activeMarker" : "tagBlock"}
                      type="button"
                      style={{
                        left: `${Math.min(100, Math.max(0, (startTime / duration) * 100))}%`,
                        width: `${Math.max(1, Math.min(100, ((endTime - startTime) / duration) * 100))}%`,
                        top: `${laneIndex * 24}px`,
                        background: tag.color
                      }}
                      title={`${formatClockTime(startTime)} - ${formatClockTime(endTime)} - ${tag.label}`}
                      aria-label={`Select ${tag.label}; double click to jump to ${formatClockTime(startTime)}`}
                      onClick={() => selectTag(tag.id)}
                      onDoubleClick={() => jumpToTagStart(tag)}
                    >
                      {tag.label}
                    </button>
                  ))
                  : null}
              </div>
            </div>
            <TimelineSlider
              max={duration || 0}
              value={Math.min(currentTime, duration || 0)}
              disabled={!video || duration <= 0}
              label="Video timeline"
              onChange={seekTo}
            />
          </div>
        </section>

        {editingDrawing ? (
          <div className="modalBackdrop" role="presentation">
            <div className={isDrawingMaximized ? "tagModal drawingModal drawingModalMaximized" : "tagModal drawingModal"} role="dialog" aria-modal="true" aria-label="Draw on frame">
              <div className="cardHeader">
                <h2>Draw on frame — {formatClockTime(editingDrawing.videoTime)}</h2>
                <div className="drawingModalHeaderActions">
                  {editingDrawing.drawingId ? (
                    <button
                      type="button"
                      className="dangerButton"
                      onClick={() => void deleteDrawingFrame(editingDrawing.tagId, editingDrawing.drawingId!)}
                    >
                      Delete Picture
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setIsDrawingMaximized((current) => !current)}>
                    {isDrawingMaximized ? "Minimize" : "Maximize"}
                  </button>
                </div>
              </div>
              <DrawingCanvas
                imageUrl={editingDrawing.imageUrl}
                initialShapes={editingDrawing.initialShapes}
                onCancel={closeDrawingFrame}
                onSave={saveEditingDrawing}
                onDownload={(dataUrl) =>
                  window.clipboardCoach
                    .saveDrawingAs(dataUrl, `drawing-${formatClockTime(editingDrawing.videoTime).replace(/:/g, "-")}.png`)
                    .then((savedPath) => {
                      if (savedPath) {
                        setStatus(`Drawing saved to ${savedPath}.`);
                      }
                    })
                }
              />
            </div>
          </div>
        ) : null}

        {isTeamModalOpen ? (
          <div className="modalBackdrop" role="presentation">
            <div className="tagModal wideModal" role="dialog" aria-modal="true" aria-label="Select team">
              <h2>Add Team</h2>
              <p>Select a saved team, then choose players for this match/video.</p>
              <select value={matchTeamDraftId} onChange={(event) => chooseMatchDraftTeam(event.target.value)}>
                <option value="">No team selected</option>
                {store.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <div className="playerPickList modalPickList">
                {matchDraftPlayers.map((player) => (
                  <label key={player.id}>
                    <input
                      type="checkbox"
                      checked={matchPlayerDraftIds.includes(player.id)}
                      onChange={() => toggleMatchDraftPlayer(player.id)}
                    />
                    {getPlayerDisplayName(player)}
                  </label>
                ))}
              </div>
              <div className="modalActions">
                <button type="button" onClick={cancelTeamModal}>
                  Cancel
                </button>
                <button className="primaryButton" type="button" onClick={confirmTeamModal}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isPlayerModalOpen ? (
          <div className="modalBackdrop" role="presentation">
            <form className="tagModal wideModal" onSubmit={addQuickPlayerToVideoTeam} role="dialog" aria-modal="true" aria-label="Add player">
              <h2>Add Player</h2>
              <p>Add a player to {videoTeam?.name ?? "the selected team"} and this match/video.</p>
              <input
                value={quickPlayerDraft.firstName}
                onChange={(event) => setQuickPlayerDraft((current) => ({ ...current, firstName: event.target.value }))}
                placeholder="First name"
                aria-label="First name"
              />
              <input
                value={quickPlayerDraft.lastName}
                onChange={(event) => setQuickPlayerDraft((current) => ({ ...current, lastName: event.target.value }))}
                placeholder="Last name"
                aria-label="Last name"
              />
              <input
                value={quickPlayerDraft.email}
                onChange={(event) => setQuickPlayerDraft((current) => ({ ...current, email: event.target.value }))}
                placeholder="Email optional"
                aria-label="Email"
              />
              <div className="modalActions">
                <button type="button" onClick={() => setIsPlayerModalOpen(false)}>
                  Cancel
                </button>
                <button className="primaryButton" type="submit" disabled={!videoTeam}>
                  Confirm
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {isStandardTagsModalOpen ? (
          <div className="modalBackdrop" role="presentation">
            <form className="tagModal wideModal" onSubmit={addStandardTag} role="dialog" aria-modal="true" aria-label="Standard tags">
              <h2>Standard Tags</h2>
              <p>Start and Goal are protected defaults. Custom tags are saved locally.</p>
              <div className="standardTagManager">
                {standardTags.map((tagName) => (
                  <div key={tagName}>
                    <span>{tagName}</span>
                    {tagName === "Start" || tagName === "Goal" ? (
                      <small>Default</small>
                    ) : (
                      <button type="button" onClick={() => removeStandardTag(tagName)}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="quickPlayerForm">
                <input
                  value={newStandardTagText}
                  onChange={(event) => setNewStandardTagText(event.target.value)}
                  placeholder="New standard tag"
                  aria-label="New standard tag"
                />
                <button type="submit">Add</button>
              </div>
              <div className="modalActions">
                <button type="button" onClick={() => setIsStandardTagsModalOpen(false)}>
                  Close
                </button>
                <button className="primaryButton" type="button" onClick={() => setIsStandardTagsModalOpen(false)}>
                  Done
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {isPreviousVideosModalOpen ? (
          <div className="modalBackdrop" role="presentation">
            <div className="tagModal wideModal" role="dialog" aria-modal="true" aria-label="Browse previous videos">
              <h2>Browse Previous Videos</h2>
              <div className="previousVideoList">
                {previousVideos.map((previousVideo) => (
                  <button
                    className={previousVideo.missing ? "previousVideoButton missingPrevious" : "previousVideoButton"}
                    type="button"
                    key={previousVideo.path}
                    disabled={previousVideo.missing}
                    onClick={() => {
                      setIsPreviousVideosModalOpen(false);
                      openPreviousVideo(previousVideo.path);
                    }}
                  >
                    <strong>{previousVideo.name}</strong>
                    <span>{previousVideo.missing ? "File missing" : `${previousVideo.tags.length} saved tags`}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setIsPreviousVideosModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        ) : null}

        {isClipBuilderOpen ? (
          <div className="modalBackdrop" role="presentation">
            <form className="tagModal clipBuilderModal" onSubmit={createClipRecord} role="dialog" aria-modal="true" aria-label="Make clip">
              <h2>Make Clip</h2>
              <p>Create a local prepared clip record. No video file will be exported yet.</p>
              <label>
                Clip name
                <input
                  value={clipDraft.name}
                  onChange={(event) => {
                    setIsClipNameTouched(true);
                    setClipDraft((current) => ({ ...current, name: event.target.value }));
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="Clip name"
                  aria-label="Clip name"
                />
              </label>
              <div className="clipBuilderSource">
                <span>Current video</span>
                <strong>{video?.name ?? "No video open"}</strong>
              </div>
              <section className="clipBuilderSection">
                <h3>Team</h3>
                <label>
                  Clip team
                  <select
                    value={clipDraft.teamId}
                    onChange={(event) => chooseClipDraftTeam(event.target.value)}
                  >
                    <option value="">No team / General clip</option>
                    {store.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
                {!clipDraftTeam ? <p>General clips stay in the global Clips page and are not added to a team.</p> : null}
              </section>
              <section className="clipBuilderSection">
                <h3>Quick Select by Tag Name</h3>
                <div className="quickTagButtons">
                  {currentVideoTagNames.map((tagName) => (
                    <button type="button" key={tagName} onClick={() => selectClipTagsByName(tagName)}>
                      {tagName}
                    </button>
                  ))}
                </div>
              </section>
              <section className="clipBuilderSection">
                <h3>Tags</h3>
                <div className="clipBuilderTagList">
                  {visibleTagItems.map((item) => (
                    <label key={item.selectionId}>
                      <input
                        type="checkbox"
                        checked={clipDraft.selectedTagIds.includes(item.selectionId)}
                        onChange={() => toggleClipDraftTag(item.selectionId)}
                      />
                      <span>
                        <strong>{item.blockLabel} · {item.tag.label}</strong>
                        <small>
                          {formatClockTime(item.videoTime)} -{" "}
                          {formatClockTime(item.tag.endTime ?? item.videoTime + 5)}
                        </small>
                        {item.tag.playerIds && item.tag.playerIds.length > 0 ? (
                          <small>Players: {getTagPlayerNames(item.tag).join(", ") || "Linked players saved on tag"}</small>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
              <section className="clipBuilderSection">
                <h3>Intended Audience</h3>
                <label>
                  <input
                    type="radio"
                    checked={clipDraft.audienceType === "full_team"}
                    disabled={!hasClipDraftTeam}
                    onChange={() => setClipDraft((current) => ({ ...current, audienceType: "full_team" }))}
                  />
                  Full team
                </label>
                <label>
                  <input
                    type="radio"
                    checked={clipDraft.audienceType === "selected_match_players"}
                    disabled={!canUseSelectedMatchPlayers}
                    onChange={() => setClipDraft((current) => ({ ...current, audienceType: "selected_match_players" }))}
                  />
                  Selected match players
                  {hasClipDraftTeam && !canUseSelectedMatchPlayers ? <span>No selected match players for this team.</span> : null}
                </label>
                <label>
                  <input
                    type="radio"
                    checked={clipDraft.audienceType === "specific_players"}
                    disabled={!hasClipDraftTeam}
                    onChange={() => setClipDraft((current) => ({ ...current, audienceType: "specific_players" }))}
                  />
                  Specific players
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={clipDraft.includeStaff}
                    disabled={!hasClipDraftTeam}
                    onChange={(event) => setClipDraft((current) => ({ ...current, includeStaff: event.target.checked }))}
                  />
                  Include Staff
                </label>
                {clipDraft.audienceType === "specific_players" ? (
                  <div className="clipBuilderPlayers">
                    {clipDraftPlayers.length === 0 ? <span>No players saved for this team.</span> : null}
                    {clipDraftPlayers.map((player) => (
                      <label key={player.id}>
                        <input
                          type="checkbox"
                          checked={clipDraft.specificPlayerIds.includes(player.id)}
                          onChange={() => toggleSpecificClipPlayer(player.id)}
                        />
                        {getPlayerDisplayName(player)}
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
              <div className="modalActions">
                <button type="button" onClick={() => setIsClipBuilderOpen(false)}>
                  Cancel
                </button>
                <button className="primaryButton" type="submit" disabled={!video || clipDraft.selectedTagIds.length === 0}>
                  Save Clip Record
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {isAddTagOpen ? (
          <div className="modalBackdrop" role="presentation">
            <form
              className="tagModal"
              onSubmit={confirmAddTag}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Add tag"
            >
              <h2>Add Tag</h2>
              <p>Create a tag at {formatClockTime(currentTime)}.</p>
              <input
                ref={addTagInputRef}
                value={newTagText}
                onChange={(event) => {
                  setNewTagText(event.target.value);
                  if (event.target.value.trim().length > 0) {
                    setAddTagError("");
                  }
                }}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                autoFocus
                placeholder="Tag name"
                aria-label="Tag name"
              />
              {addTagError ? <p className="fieldError">{addTagError}</p> : null}
              <div className="modalActions">
                <button
                  type="button"
                  onClick={() => {
                    setAddTagError("");
                    setIsAddTagOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button className="primaryButton" type="submit">
                  Confirm
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </main>
    );
  }

  async function handleTrackingSave(updatedStore: AppStore) {
    const saved = await window.clipboardCoach.saveStore(updatedStore);
    setStore(saved);
  }

  const currentScreen =
    screen === "teams"
      ? renderTeams()
      : screen === "video"
        ? renderVideoViewer()
        : screen === "clips"
          ? renderClips()
          : screen === "settings"
            ? renderSettings()
            : screen === "tracking"
              ? (
                <TrackingScreen
                  store={store}
                  onSaveStore={handleTrackingSave}
                  onBack={() => setScreen("home")}
                  onOpenTrackingViewer={(videoId) => {
                    setTrackingViewerVideoId(videoId);
                    setScreen("playerTrackingViewer");
                  }}
                />
              )
              : screen === "playerTrackingViewer" && trackingViewerVideoId
                ? (
                  <PlayerTrackingViewer
                    store={store}
                    videoId={trackingViewerVideoId}
                    onSaveStore={handleTrackingSave}
                    onBack={() => setScreen("tracking")}
                  />
                )
                : renderHome();
  const pendingClipDelete = store.clips.find((clip) => clip.id === pendingClipDeleteId) ?? null;

  return (
    <>
      {currentScreen}
      {renderMatchModal()}
      {pendingClipDelete ? (
        <div className="modalBackdrop" role="presentation" onClick={() => setPendingClipDeleteId(null)}>
          <section
            className="tagModal confirmDeleteModal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-clip-title"
            aria-describedby="delete-clip-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirmDeleteHeader">
              <span className="confirmDeleteIcon" aria-hidden="true">!</span>
              <div>
                <h2 id="delete-clip-title">Delete Clip?</h2>
                <p id="delete-clip-message">
                  Delete “{pendingClipDelete.name}”? The source video and tags will stay saved.
                </p>
              </div>
            </div>
            <div className="modalActions">
              <button type="button" onClick={() => setPendingClipDeleteId(null)}>
                Cancel
              </button>
              <button className="confirmDeleteButton" type="button" onClick={() => void deleteClipRecord(pendingClipDelete.id)}>
                Delete Clip
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

type HeaderProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
  visualSrc?: string;
};

function Header({ title, subtitle, onBack, visualSrc }: HeaderProps) {
  return (
    <header className="sectionHeader">
      <button type="button" className="headerHomeBtn" onClick={onBack} title="Home">
        <img src={navHomeUrl} alt="Home" />
      </button>
      <div className="sectionHeaderInfo">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {visualSrc ? <img className="sectionHeaderArtwork" src={visualSrc} alt="" /> : null}
    </header>
  );
}

export default App;
