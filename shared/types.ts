import type { Box2D, Point2D } from "./geometry";

export type VideoFile = {
  path: string;
  name: string;
  extension: string;
  url: string;
  storeKey?: string;
  originalSourcePath?: string;
  playbackPath?: string;
  compatibleWorkingCopyPath?: string;
  mediaInfo?: VideoInspectionResult;
  workingCopy?: VideoWorkingCopy;
};

export type VideoTag = {
  id: string;
  time: number;
  startTime?: number;
  endTime?: number;
  label: string;
  color?: string;
  playerIds?: string[];
  playerRefs?: PlayerReference[];
  createdAt: string;
  drawings?: TagDrawingRecord[];
};

export type TagDrawingRecord = {
  id: string;
  baseFrameUrl: string;
  shapes: DrawingShape[];
  thumbnailUrl: string;
  videoTime: number;
  durationSeconds: number;
};

export type DrawingPoint = Point2D;

export type DrawingBox = Box2D;

export type DrawingShape =
  | { type: "arrow"; start: DrawingPoint; end: DrawingPoint; color: string; lineWidth: number; dashed: boolean }
  | { type: "circle"; center: DrawingPoint; radius: number; color: string; lineWidth: number }
  | { type: "polygon"; points: DrawingPoint[]; color: string; lineWidth: number }
  | { type: "text"; box: DrawingBox; text: string; color: string };

export type Player = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: "player" | "staff";
  createdAt: string;
};

export type Team = {
  id: string;
  name: string;
  players: Player[];
  createdAt: string;
};

export type FieldReferencePoint = {
  id: string;
  label: string;
  point: { x: number; y: number };
  fieldX: number;
  fieldY: number;
  groupId?: string;
};

export type FieldTypeId = "11v11" | "8v8_groot" | "8v8_klein" | "5v5";

export type TrackingCalibration = {
  points: FieldReferencePoint[];
  fieldType?: FieldTypeId;
  pitchLength?: number;
  pitchWidth?: number;
  // Whether the calibrated goal (field x=0) is the tracked team's own goal.
  // undefined = never marked (legacy calibrations) - treated as "unknown,
  // don't flip" by consumers.
  ownGoalAtOrigin?: boolean;
  // For a derived small-sided (e.g. 8vs8) pitch: whether the team's own
  // small goal sits near the big pitch's positive-Y touchline. undefined =
  // never marked - treated as "unknown, don't flip" by consumers.
  ownSmallGoalNearPositiveY?: boolean;
  capturedFrameTime: number;
};

export type HeatmapCalibration = {
  // Normalized video coordinates. Order is fixed: top-left, top-right,
  // bottom-left, bottom-right as seen in the selected calibration frame.
  corners: [Point2D, Point2D, Point2D, Point2D];
  ownBackline: "left" | "right";
  capturedFrameTime: number;
};

export type PlayerTrackSample = {
  frameIndex: number;
  timeSeconds: number;
  box: Box2D;
  confidence: number;
};

export type PlayerTrackRecord = {
  trackId: number;
  playerId?: string;
  playerName: string;
  samples: PlayerTrackSample[];
};

// A user-placed starting point for one player, at the first frame of the
// tracked range. The main process resolves this to an actual detection box
// (or a fallback box if nothing was detected right there) before tracking
// begins - the point itself is just where the user clicked on-screen.
export type ManualTrackSeed = {
  trackId: number;
  playerId?: string;
  playerName: string;
  point: Point2D;
};

export type PlayerTrackingRun = {
  computedAt: string;
  startSeconds: number;
  endSeconds: number;
  sampleFps: number;
  tracks: PlayerTrackRecord[];
};

export type PlayerTrackingProgress = {
  videoKey: string;
  stage: "extracting" | "detecting";
  progress: number;
};

export type StoredVideo = {
  path: string;
  name: string;
  extension: string;
  lastOpenedAt: string;
  tags: VideoTag[];
  matchState?: MatchState;
  matchInfo?: MatchInfo;
  kickoffVideoOffset?: number;
  blockEndVideoOffset?: number;
  matchId?: string;
  matchBlockNumber?: number;
  matchBlockLabel?: string;
  matchBlockStartMinute?: number;
  missing?: boolean;
  calibration?: TrackingCalibration;
  heatmapCalibration?: HeatmapCalibration;
  tracking?: PlayerTrackingRun;
  originalSourcePath?: string;
  playbackPath?: string;
  compatibleWorkingCopyPath?: string;
  mediaInfo?: VideoInspectionResult;
  workingCopy?: VideoWorkingCopy;
};

export type VideoStreamInfo = {
  codec?: string;
  profile?: string;
  pixelFormat?: string;
  width?: number;
  height?: number;
  frameRate?: number;
  durationSeconds?: number;
};

export type AudioStreamInfo = {
  codec?: string;
};

export type VideoInspectionResult = {
  path: string;
  container?: string;
  durationSeconds?: number;
  video?: VideoStreamInfo;
  audio?: AudioStreamInfo;
  directPlaybackLikelySupported: boolean;
  compatibilityReason?: string;
};

export type VideoWorkingCopy = {
  sourcePath: string;
  playbackPath: string;
  createdAt: string;
  sourceSize: number;
  sourceModifiedMs: number;
  videoCodec?: string;
  encoder: "h264_nvenc" | "libx264" | "unknown";
};

export type VideoWorkingCopyProgress = {
  sourcePath: string;
  outputPath?: string;
  stage: "starting" | "transcoding" | "validating" | "ready";
  progress: number;
  encoder?: VideoWorkingCopy["encoder"];
};

export type StoredMatch = {
  id: string;
  date: string;
  startTime?: string;
  teamAName: string;
  teamBName: string;
  teamAId?: string;
  teamBId?: string;
  selectedTeamAPlayerIds: string[];
  selectedTeamBPlayerIds: string[];
  videoBlockIds: string[];
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
};

export type MatchInfo = {
  title?: string;
  homeTeam?: string;
  awayTeam?: string;
  date?: string;
};

export type MatchState = {
  teamId?: string;
  teamName?: string;
  players: MatchPlayerState[];
};

export type MatchPlayerState = {
  id: string;
  name: string;
};

export type PlayerReference = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
};

export type ClipRecord = {
  id: string;
  name: string;
  filePath: string;
  teamId?: string;
  teamName?: string;
  sourceVideoPath?: string;
  sourceVideoName?: string;
  matchTitle?: string;
  startTime?: number;
  endTime?: number;
  selectedTagIds?: string[];
  tagNames?: string[];
  tagSnapshots?: ClipTagSnapshot[];
  intendedAudience?: ClipAudience;
  exportStatus?: "prepared_only" | "not_exported" | "exported";
  localClipPath?: string | null;
  shareUrl?: string | null;
  uploadStatus?: "not_uploaded";
  missingExportFile?: boolean;
  missingSourceVideo?: boolean;
  shareWithStaff?: boolean;
  createdAt: string;
  missing?: boolean;
};

export type ClipDrawing = {
  id?: string;
  dataUrl: string;
  durationSeconds: number;
  videoTime: number;
};

export type CropRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  unit?: "pixels" | "normalized";
};

export type CameraKeyframe = {
  time: number;
  crop?: CropRegion;
  zoom?: number;
  center?: Point2D;
  easing?: "linear" | "ease_in" | "ease_out" | "ease_in_out";
};

export type ClipTagSnapshot = {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  sourceVideoId?: string;
  sourceVideoPath?: string;
  blockNumber?: number;
  blockLabel?: string;
  blockStartMinute?: number;
  playerIds?: string[];
  playerRefs?: PlayerReference[];
  drawings?: ClipDrawing[];
};

export type ClipAudience = {
  type: "full_team" | "selected_match_players" | "specific_players";
  teamId?: string;
  teamName?: string;
  players: MatchPlayerState[];
};

export type AppStore = {
  teams: Team[];
  videos: Record<string, StoredVideo>;
  clips: ClipRecord[];
  matches: StoredMatch[];
  settings: AppSettings;
};

export type AppSettings = {
  standardTags: string[];
  lastSelectedTeamId?: string;
  activeMatchTeamId?: string;
  activeMatchPlayerIds: string[];
  playerNameOrder?: "first_last" | "last_first";
  theme?: "dark" | "light";
};

export type ClipExportSegment = {
  sourceVideoPath: string;
  startTime: number;
  endTime: number;
  drawings?: ClipDrawing[];
};

export type ClipSegmentRecipe = {
  sourceVideoPath: string;
  startTime: number;
  endTime: number;
  crop?: CropRegion;
  cameraKeyframes?: CameraKeyframe[];
  drawings?: ClipDrawing[];
};

export type ClipRecipe = {
  segments: ClipSegmentRecipe[];
};

export type ClipExportRequest = {
  clipId: string;
  segments: ClipExportSegment[];
  suggestedName: string;
};

export type ClipExportResult = {
  clipId: string;
  filePath: string;
};

export type ClipExportProgress = {
  clipId: string;
  progress: number;
  stage: "trimming" | "concatenating";
};

export type ClipExportError = {
  clipId: string;
  message: string;
};
