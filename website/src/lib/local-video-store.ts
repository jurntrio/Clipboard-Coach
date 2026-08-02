const DATABASE_NAME = "clipboard-coach-local-videos";
const STORE_NAME = "video-handles";

type LocalFileHandle = FileSystemFileHandle & {
  queryPermission?: (options?: { mode?: "read" }) => Promise<PermissionState>;
  requestPermission?: (options?: { mode?: "read" }) => Promise<PermissionState>;
};

const sessionFiles = new Map<string, File>();

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readHandle(videoId: string): Promise<LocalFileHandle | null> {
  try {
    const database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(videoId);
      request.onsuccess = () => resolve((request.result as LocalFileHandle | undefined) ?? null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  } catch {
    return null;
  }
}

export async function rememberLocalVideo(videoId: string, file: File, handle?: FileSystemFileHandle | null) {
  sessionFiles.set(videoId, file);
  if (!handle) return;

  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(handle, videoId);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // Some browsers cannot structured-clone file handles. Same-session access still works.
  }
}

export async function getRememberedLocalVideo(videoId: string, askPermission = false): Promise<File | null> {
  const sessionFile = sessionFiles.get(videoId);
  if (sessionFile) return sessionFile;

  const handle = await readHandle(videoId);
  if (!handle) return null;

  try {
    let permission = handle.queryPermission ? await handle.queryPermission({ mode: "read" }) : "granted";
    if (permission !== "granted" && askPermission && handle.requestPermission) {
      permission = await handle.requestPermission({ mode: "read" });
    }
    if (permission !== "granted") return null;
    const file = await handle.getFile();
    sessionFiles.set(videoId, file);
    return file;
  } catch {
    return null;
  }
}

export async function localVideoFingerprint(file: File) {
  const value = `${file.name}\n${file.size}\n${file.lastModified}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function matchesLocalVideo(
  file: File,
  video: { video_key: string; file_size: number | null; duration: number | null },
  inspectedDuration?: number | null
) {
  const fingerprint = await localVideoFingerprint(file);
  if (video.video_key === `local/${fingerprint}`) return true;

  // Copies of the same file can receive a different lastModified timestamp when
  // transferred by USB, download or network share. The legacy fingerprint includes
  // that timestamp, so use stable media properties as a safe compatibility fallback.
  if (video.file_size === null || file.size !== video.file_size || inspectedDuration == null || video.duration == null) {
    return false;
  }
  return Math.abs(inspectedDuration - video.duration) <= 1;
}

export function isLocalVideoUrl(url: string | null | undefined) {
  return !!url?.startsWith("local://");
}
