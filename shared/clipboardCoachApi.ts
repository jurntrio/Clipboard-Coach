import type {
  AppStore,
  ClipExportProgress,
  ClipExportRequest,
  ClipExportResult,
  ManualTrackSeed,
  PlayerTrackingProgress,
  PlayerTrackingRun,
  VideoFile,
  VideoWorkingCopyProgress,
  VideoTag
} from "./types";

export type ClipboardCoachApi = {
  openVideo: () => Promise<VideoFile | null>;
  openVideoFromPath: (videoPath: string) => Promise<VideoFile>;
  onVideoWorkingCopyProgress: (callback: (progress: VideoWorkingCopyProgress) => void) => () => void;
  loadStore: () => Promise<AppStore>;
  saveStore: (store: AppStore) => Promise<AppStore>;
  loadTags: (videoPath: string) => Promise<VideoTag[]>;
  saveTags: (videoPath: string, tags: VideoTag[]) => Promise<VideoTag[]>;
  exportClip: (request: ClipExportRequest) => Promise<ClipExportResult | null>;
  onClipExportProgress: (callback: (progress: ClipExportProgress) => void) => () => void;
  saveClipAs: (sourcePath: string, suggestedName: string) => Promise<string | null>;
  saveDrawingAs: (dataUrl: string, suggestedName: string) => Promise<string | null>;
  runPlayerTracking: (
    videoKey: string,
    request: { startSeconds: number; endSeconds: number; seeds: ManualTrackSeed[] }
  ) => Promise<PlayerTrackingRun>;
  onPlayerTrackingProgress: (callback: (progress: PlayerTrackingProgress) => void) => () => void;
  quitApp: () => Promise<void>;
};
