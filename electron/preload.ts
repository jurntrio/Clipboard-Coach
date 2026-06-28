import { contextBridge, ipcRenderer } from "electron";

type VideoFile = {
  path: string;
  name: string;
  extension: string;
  url: string;
};

type VideoTag = {
  id: string;
  time: number;
  startTime?: number;
  endTime?: number;
  label: string;
  color?: string;
  playerIds?: string[];
  playerRefs?: PlayerReference[];
  createdAt: string;
};

type Player = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  createdAt: string;
};

type Team = {
  id: string;
  name: string;
  players: Player[];
  createdAt: string;
};

type StoredVideo = {
  path: string;
  name: string;
  extension: string;
  lastOpenedAt: string;
  tags: VideoTag[];
  matchState?: MatchState;
  matchInfo?: MatchInfo;
  missing?: boolean;
};

type MatchInfo = {
  title?: string;
  homeTeam?: string;
  awayTeam?: string;
  date?: string;
};

type MatchState = {
  teamId?: string;
  teamName?: string;
  players: MatchPlayerState[];
};

type MatchPlayerState = {
  id: string;
  name: string;
};

type PlayerReference = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
};

type ClipRecord = {
  id: string;
  name: string;
  filePath: string;
  sourceVideoPath?: string;
  sourceVideoName?: string;
  matchTitle?: string;
  startTime?: number;
  endTime?: number;
  selectedTagIds?: string[];
  tagNames?: string[];
  tagSnapshots?: ClipTagSnapshot[];
  intendedAudience?: ClipAudience;
  exportStatus?: "prepared_only" | "not_exported";
  localClipPath?: string | null;
  shareUrl?: string | null;
  uploadStatus?: "not_uploaded";
  missingExportFile?: boolean;
  missingSourceVideo?: boolean;
  createdAt: string;
  missing?: boolean;
};

type ClipTagSnapshot = {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  playerIds?: string[];
  playerRefs?: PlayerReference[];
};

type ClipAudience = {
  type: "full_team" | "selected_match_players" | "specific_players";
  teamId?: string;
  teamName?: string;
  players: MatchPlayerState[];
};

type AppStore = {
  teams: Team[];
  videos: Record<string, StoredVideo>;
  clips: ClipRecord[];
  settings: AppSettings;
};

type AppSettings = {
  standardTags: string[];
  activeMatchTeamId?: string;
  activeMatchPlayerIds: string[];
};

contextBridge.exposeInMainWorld("clipboardCoach", {
  openVideo: () => ipcRenderer.invoke("video:open") as Promise<VideoFile | null>,
  openVideoFromPath: (videoPath: string) => ipcRenderer.invoke("video:fromPath", videoPath) as Promise<VideoFile>,
  loadStore: () => ipcRenderer.invoke("store:load") as Promise<AppStore>,
  saveStore: (store: AppStore) => ipcRenderer.invoke("store:save", store) as Promise<AppStore>,
  loadTags: (videoPath: string) => ipcRenderer.invoke("tags:load", videoPath) as Promise<VideoTag[]>,
  saveTags: (videoPath: string, tags: VideoTag[]) =>
    ipcRenderer.invoke("tags:save", videoPath, tags) as Promise<VideoTag[]>
});
