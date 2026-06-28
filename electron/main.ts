import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type VideoTag = {
  id: string;
  time: number;
  label: string;
  createdAt: string;
};

type TagStore = {
  videos: Record<string, VideoTag[]>;
};

const isDev = !app.isPackaged;

function getStorePath() {
  return path.join(app.getPath("userData"), "tags.json");
}

async function readStore(): Promise<TagStore> {
  try {
    const raw = await fs.readFile(getStorePath(), "utf-8");
    const parsed = JSON.parse(raw) as TagStore;
    return { videos: parsed.videos ?? {} };
  } catch {
    return { videos: {} };
  }
}

async function writeStore(store: TagStore) {
  await fs.mkdir(path.dirname(getStorePath()), { recursive: true });
  await fs.writeFile(getStorePath(), JSON.stringify(store, null, 2), "utf-8");
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#f7f7f4",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    window.loadURL("http://127.0.0.1:5173");
  } else {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  ipcMain.handle("video:open", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open a video file",
      properties: ["openFile"],
      filters: [
        {
          name: "Video files",
          extensions: ["mp4", "mov", "m4v", "webm", "ogg", "avi", "mkv"]
        }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0];
    return {
      path: filePath,
      name: path.basename(filePath),
      url: pathToFileURL(filePath).toString()
    };
  });

  ipcMain.handle("tags:load", async (_event, videoPath: string) => {
    const store = await readStore();
    return store.videos[videoPath] ?? [];
  });

  ipcMain.handle("tags:save", async (_event, videoPath: string, tags: VideoTag[]) => {
    const store = await readStore();
    store.videos[videoPath] = tags;
    await writeStore(store);
    return tags;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
