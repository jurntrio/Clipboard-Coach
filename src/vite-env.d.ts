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
  label: string;
  createdAt: string;
};

interface Window {
  clipboardCoach: {
    openVideo: () => Promise<VideoFile | null>;
    loadTags: (videoPath: string) => Promise<VideoTag[]>;
    saveTags: (videoPath: string, tags: VideoTag[]) => Promise<VideoTag[]>;
  };
}
