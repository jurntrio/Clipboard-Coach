/// <reference types="vite/client" />

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
  missing?: boolean;
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

type ClipRecord = {
  id: string;
  name: string;
  filePath: string;
  sourceVideoPath?: string;
  sourceVideoName?: string;
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
  createdAt: string;
  missing?: boolean;
};

type ClipTagSnapshot = {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  playerIds?: string[];
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

interface Window {
  clipboardCoach: {
    openVideo: () => Promise<VideoFile | null>;
    openVideoFromPath: (videoPath: string) => Promise<VideoFile>;
    loadStore: () => Promise<AppStore>;
    saveStore: (store: AppStore) => Promise<AppStore>;
    loadTags: (videoPath: string) => Promise<VideoTag[]>;
    saveTags: (videoPath: string, tags: VideoTag[]) => Promise<VideoTag[]>;
  };
}
