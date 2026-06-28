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
};

type ClipRecord = {
  id: string;
  name: string;
  filePath: string;
  sourceVideoPath?: string;
  startTime?: number;
  endTime?: number;
  createdAt: string;
  missing?: boolean;
};

type AppStore = {
  teams: Team[];
  videos: Record<string, StoredVideo>;
  clips: ClipRecord[];
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
