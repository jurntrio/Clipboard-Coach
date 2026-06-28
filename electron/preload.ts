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
  label: string;
  createdAt: string;
};

contextBridge.exposeInMainWorld("clipboardCoach", {
  openVideo: () => ipcRenderer.invoke("video:open") as Promise<VideoFile | null>,
  loadTags: (videoPath: string) => ipcRenderer.invoke("tags:load", videoPath) as Promise<VideoTag[]>,
  saveTags: (videoPath: string, tags: VideoTag[]) =>
    ipcRenderer.invoke("tags:save", videoPath, tags) as Promise<VideoTag[]>
});
