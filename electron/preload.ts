import { contextBridge, ipcRenderer } from "electron";
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
} from "../shared/types";
import type { ClipboardCoachApi } from "../shared/clipboardCoachApi";

const clipboardCoachApi: ClipboardCoachApi = {
  openVideo: () => ipcRenderer.invoke("video:open") as Promise<VideoFile | null>,
  openVideoFromPath: (videoPath: string) => ipcRenderer.invoke("video:fromPath", videoPath) as Promise<VideoFile>,
  onVideoWorkingCopyProgress: (callback: (progress: VideoWorkingCopyProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: VideoWorkingCopyProgress) => callback(progress);
    ipcRenderer.on("video:working-copy:progress", listener);
    return () => ipcRenderer.removeListener("video:working-copy:progress", listener);
  },
  loadStore: () => ipcRenderer.invoke("store:load") as Promise<AppStore>,
  saveStore: (store: AppStore) => ipcRenderer.invoke("store:save", store) as Promise<AppStore>,
  loadTags: (videoPath: string) => ipcRenderer.invoke("tags:load", videoPath) as Promise<VideoTag[]>,
  saveTags: (videoPath: string, tags: VideoTag[]) =>
    ipcRenderer.invoke("tags:save", videoPath, tags) as Promise<VideoTag[]>,
  exportClip: (request: ClipExportRequest) =>
    ipcRenderer.invoke("clip:export", request) as Promise<ClipExportResult | null>,
  onClipExportProgress: (callback: (progress: ClipExportProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: ClipExportProgress) => callback(progress);
    ipcRenderer.on("clip:export:progress", listener);
    return () => ipcRenderer.removeListener("clip:export:progress", listener);
  },
  saveClipAs: (sourcePath: string, suggestedName: string) =>
    ipcRenderer.invoke("clip:saveAs", { sourcePath, suggestedName }) as Promise<string | null>,
  saveDrawingAs: (dataUrl: string, suggestedName: string) =>
    ipcRenderer.invoke("drawing:saveAs", { dataUrl, suggestedName }) as Promise<string | null>,
  runPlayerTracking: (
    videoKey: string,
    request: { startSeconds: number; endSeconds: number; seeds: ManualTrackSeed[] }
  ) => ipcRenderer.invoke("tracking:run", videoKey, request) as Promise<PlayerTrackingRun>,
  onPlayerTrackingProgress: (callback: (progress: PlayerTrackingProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: PlayerTrackingProgress) => callback(progress);
    ipcRenderer.on("tracking:progress", listener);
    return () => ipcRenderer.removeListener("tracking:progress", listener);
  },
  quitApp: () => ipcRenderer.invoke("app:quit") as Promise<void>
};

contextBridge.exposeInMainWorld("clipboardCoach", clipboardCoachApi);
