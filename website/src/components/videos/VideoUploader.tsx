"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Video } from "@/types/database";
import { inspectLocalVideo } from "@/lib/media/local-clips";
import { isLocalVideoUrl, localVideoFingerprint, rememberLocalVideo } from "@/lib/local-video-store";

// R2 rejects a single PUT over roughly 5 GB. Large camera recordings use
// multipart upload; regular uploads use XHR so progress is visible.
const MULTIPART_THRESHOLD = 4 * 1024 * 1024 * 1024;
const PART_SIZE = 100 * 1024 * 1024;
const UPLOAD_CONCURRENCY = 4;
const SUPPORTED_VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm"]);

type UploadPhase = "inspecting" | "preparing" | "uploading" | "saving" | "complete";

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(body?.error ? `${fallback}: ${body.error}` : `${fallback} (HTTP ${response.status})`);
}

function safeFileName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "video";
}

function formatFileSize(bytes: number | null) {
  if (bytes === null) return "Unknown size";
  if (bytes === 0) return "0 MB";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

async function callMultipartApi(action: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/videos/multipart-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  if (!res.ok) throw await responseError(res, `Multipart "${action}" request failed`);
  return res.json();
}

function putWithProgress(url: string, file: Blob, contentType: string, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`Upload to storage failed (HTTP ${request.status}).`));
      }
    };
    request.onerror = () => reject(new Error(
      "The browser could not reach video storage. Add this website's exact address to the Cloudflare R2 CORS policy and allow PUT + Content-Type."
    ));
    request.onabort = () => reject(new Error("Upload cancelled."));
    request.send(file);
  });
}

async function uploadSingle(file: File, key: string, onProgress: (fraction: number) => void): Promise<string> {
  const res = await fetch("/api/videos/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, contentType: file.type })
  });
  if (!res.ok) throw await responseError(res, "Could not prepare upload");
  const { uploadUrl, publicUrl } = await res.json();

  await putWithProgress(uploadUrl, file, file.type, onProgress);
  return publicUrl;
}

async function uploadMultipart(file: File, key: string, onProgress: (fraction: number) => void): Promise<string> {
  const { uploadId } = await callMultipartApi("create", { key, contentType: file.type });
  const totalParts = Math.ceil(file.size / PART_SIZE);

  try {
    const parts: { ETag: string; PartNumber: number }[] = [];
    const loadedPerPart = new Map<number, number>();
    let nextPartNumber = 1;

    const updateProgress = () => {
      const loaded = [...loadedPerPart.values()].reduce((total, value) => total + value, 0);
      onProgress(loaded / file.size);
    };

    async function worker() {
      while (nextPartNumber <= totalParts) {
        const partNumber = nextPartNumber++;
        const start = (partNumber - 1) * PART_SIZE;
        const end = Math.min(start + PART_SIZE, file.size);
        const chunk = file.slice(start, end);
        const { urls } = await callMultipartApi("part-urls", { key, uploadId, partNumbers: [partNumber] });

        await new Promise<void>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("PUT", urls[0].url);
          request.upload.onprogress = (event) => {
            loadedPerPart.set(partNumber, event.loaded);
            updateProgress();
          };
          request.onload = () => {
            if (request.status < 200 || request.status >= 300) {
              reject(new Error(`Failed to upload part ${partNumber} (HTTP ${request.status}).`));
              return;
            }
            const etag = request.getResponseHeader("ETag");
            if (!etag) {
              reject(new Error("R2 did not expose ETag. Add ETag to ExposeHeaders in the bucket CORS policy."));
              return;
            }
            loadedPerPart.set(partNumber, chunk.size);
            updateProgress();
            parts.push({ ETag: etag, PartNumber: partNumber });
            resolve();
          };
          request.onerror = () => reject(new Error(
            "The browser could not reach video storage. Check the Cloudflare R2 CORS policy."
          ));
          request.send(chunk);
        });
      }
    }

    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, totalParts) }, worker));
    parts.sort((a, b) => a.PartNumber - b.PartNumber);
    const { publicUrl } = await callMultipartApi("complete", { key, uploadId, parts });
    return publicUrl;
  } catch (error) {
    await callMultipartApi("abort", { key, uploadId }).catch(() => undefined);
    throw error;
  }
}

type VideoUploaderProps = {
  teamId: string | null;
  videos: Video[];
  onUploaded: () => Promise<void> | void;
};

export function VideoUploader({ teamId, videos, onUploaded }: VideoUploaderProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<UploadPhase>("preparing");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const localInputRef = useRef<HTMLInputElement>(null);
  const [operation, setOperation] = useState<"local" | "upload">("upload");
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !uploading) setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, uploading]);

  useEffect(() => {
    if (!uploading) return;
    const startedAt = Date.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [uploading]);

  const uploadFile = useCallback(async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED_VIDEO_EXTENSIONS.has(extension)) {
      setError("Unsupported video format. Choose an MP4, MOV, M4V, or WebM file.");
      return;
    }

    setUploading(true);
    setOperation("upload");
    setProgress(0);
    setPhase("preparing");
    setFileName(file.name);
    setFileSize(file.size);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session has expired. Sign in again and retry the upload.");

      const key = `videos/${user.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const preparedFile = file.type
        ? file
        : new File([file], file.name, { type: "application/octet-stream", lastModified: file.lastModified });

      setPhase("uploading");
      const publicUrl = file.size >= MULTIPART_THRESHOLD
        ? await uploadMultipart(preparedFile, key, setProgress)
        : await uploadSingle(preparedFile, key, setProgress);

      setPhase("saving");
      const { data: video, error: insertError } = await supabase
        .from("videos")
        .insert({
          coach_id: user.id,
          team_id: teamId,
          video_url: publicUrl,
          video_key: key,
          file_size: file.size,
          title: file.name.replace(/\.[^/.]+$/, "")
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      fetch(`/api/videos/${video.id}/process`, { method: "POST" }).catch(() => undefined);
      await onUploaded();
      setPhase("complete");
      setProgress(1);
      window.setTimeout(() => {
        setUploading(false);
        setIsOpen(false);
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }, [teamId, onUploaded, supabase]);

  const openLocalFile = useCallback(async (file: File, handle?: FileSystemFileHandle | null) => {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["mp4", "mov", "m4v"].includes(extension)) {
      setError("Local clip export currently supports MP4, MOV, and M4V with H.264 or HEVC video and AAC audio.");
      return;
    }

    setUploading(true);
    setOperation("local");
    setPhase("inspecting");
    setProgress(0);
    setFileName(file.name);
    setFileSize(file.size);
    setError("");

    try {
      const [{ data: { user } }, info, fingerprint] = await Promise.all([
        supabase.auth.getUser(),
        inspectLocalVideo(file),
        localVideoFingerprint(file)
      ]);
      if (!user) throw new Error("Your session has expired. Sign in again and retry.");

      setPhase("saving");
      const { data: existingVideo } = await supabase
        .from("videos")
        .select("id")
        .eq("coach_id", user.id)
        .eq("video_key", `local/${fingerprint}`)
        .eq("status", "active")
        .maybeSingle();
      if (existingVideo) {
        await rememberLocalVideo(existingVideo.id, file, handle);
        setUploading(false);
        setIsOpen(false);
        router.push(`/dashboard/videos/${existingVideo.id}`);
        return;
      }

      const { data: video, error: insertError } = await supabase
        .from("videos")
        .insert({
          coach_id: user.id,
          team_id: teamId,
          video_url: `local://${fingerprint}`,
          video_key: `local/${fingerprint}`,
          file_size: file.size,
          duration: info.duration,
          processing_status: "ready",
          title: file.name.replace(/\.[^/.]+$/, "")
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      await rememberLocalVideo(video.id, file, handle);
      await onUploaded();
      setPhase("complete");
      setProgress(1);
      setUploading(false);
      setIsOpen(false);
      router.push(`/dashboard/videos/${video.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The local video could not be opened.");
      setUploading(false);
    }
  }, [onUploaded, router, supabase, teamId]);

  async function chooseLocalVideo() {
    const picker = (window as unknown as {
      showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]>;
    }).showOpenFilePicker;
    if (!picker) {
      localInputRef.current?.click();
      return;
    }

    try {
      const [handle] = await picker({
        multiple: false,
        types: [{ description: "H.264 or HEVC video", accept: { "video/mp4": [".mp4", ".m4v"], "video/quicktime": [".mov"] } }]
      });
      if (handle) await openLocalFile(await handle.getFile(), handle);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setError(error instanceof Error ? error.message : "The local video could not be opened.");
    }
  }

  const phaseLabel = phase === "inspecting"
    ? "Checking the local video…"
    : phase === "preparing"
    ? "Preparing secure upload…"
    : phase === "saving"
      ? "Saving video details…"
      : phase === "complete"
        ? (operation === "local" ? "Video ready" : "Upload complete")
        : `Uploading… ${Math.round(progress * 100)}%`;
  const estimatedTotalSeconds = progress > 0.02 ? elapsedSeconds / progress : 0;
  const remainingSeconds = Math.max(0, Math.round(estimatedTotalSeconds - elapsedSeconds));
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(""); setIsOpen(true); }}
        className="w-full rounded-xl border-2 border-dashed border-borderButton p-8 text-center hover:border-accent hover:bg-cardHover transition"
      >
        <span className="block text-textPrimary text-lg font-medium">Open or upload a video</span>
        <span className="block text-textMuted text-sm mt-1">MP4, MOV, M4V, WebM</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !uploading) setIsOpen(false);
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-borderButton bg-cardAlt p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label="Open or upload video">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-bold text-textBright">Video Viewer</h2>
                <p className="text-sm text-textMuted mt-1">Use a video from this PC, upload one, or continue where you stopped.</p>
              </div>
              <button type="button" disabled={uploading} onClick={() => setIsOpen(false)} className="px-3 py-2 rounded-lg bg-button text-textPrimary disabled:opacity-40">Close</button>
            </div>

            <input
              ref={localInputRef}
              type="file"
              accept=".mp4,.mov,.m4v,video/mp4,video/quicktime"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void openLocalFile(file);
                event.target.value = "";
              }}
            />

            <div className="grid gap-3 sm:grid-cols-2 mb-4">
              <button
                type="button"
                disabled={uploading}
                onClick={() => void chooseLocalVideo()}
                className="rounded-xl border-2 border-accent bg-accentDim p-5 text-left transition hover:bg-cardHover disabled:opacity-50"
              >
                <span className="block text-textBright font-semibold">Use video from this PC</span>
                <span className="block text-textSecondary text-sm mt-1">Recommended — the match stays local; only made clips are uploaded.</span>
              </button>
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                className="rounded-xl border border-borderButton bg-cardDeep p-5 text-left transition hover:border-accent hover:bg-cardHover disabled:opacity-50"
              >
                <span className="block text-textBright font-semibold">Upload full video</span>
                <span className="block text-textMuted text-sm mt-1">Use this when the match must remain available on other devices.</span>
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".mp4,.mov,.m4v,.webm,video/mp4,video/quicktime,video/webm"
              className="hidden"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
                event.target.value = "";
              }}
            />

            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files[0];
                if (file) void uploadFile(file);
              }}
              className={`w-full rounded-xl border-2 border-dashed p-7 transition ${dragging ? "border-accent bg-cardHover" : "border-borderButton bg-cardDeep hover:border-accent"}`}
            >
              <span className="block text-textBright font-semibold">Or drop here to upload the full video</span>
              <span className="block text-textMuted text-sm mt-1">MP4, MOV, M4V, WebM</span>
            </button>

            {error && <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-textSecondary mb-2">Previous videos</h3>
              <div className="grid gap-2">
                {videos.length === 0 && <div className="rounded-lg border border-border bg-cardDeep p-4 text-sm text-textMuted">No previous videos yet.</div>}
                {videos.slice(0, 8).map((video) => (
                  <Link key={video.id} href={`/dashboard/videos/${video.id}`} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-cardDeep px-4 py-3 hover:border-accent hover:bg-cardHover transition">
                    <span className="min-w-0">
                      <strong className="block truncate text-textPrimary">{video.title || "Untitled video"}</strong>
                      <span className="block text-xs text-textMuted mt-0.5">
                        {new Date(video.created_at).toLocaleDateString()} · {formatFileSize(video.file_size)}
                        {isLocalVideoUrl(video.video_url) ? " · LOCAL" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-accent">Open</span>
                  </Link>
                ))}
              </div>
            </div>

            {uploading && (
              <div
                className="absolute inset-0 z-10 grid place-items-center rounded-2xl p-6"
                style={{ background: "var(--bg-card-alt)" }}
                role="status"
                aria-live="polite"
              >
                <div className="w-full max-w-md rounded-xl border border-border bg-cardDeep p-6 text-center shadow-xl">
                  <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-accentDim text-2xl">↑</div>
                  <h3 className="text-xl font-bold text-textBright">{phaseLabel}</h3>
                  <p className="mt-2 truncate text-sm text-textMuted">{fileName}</p>
                  <div className="mt-6 h-3 overflow-hidden rounded-full bg-button">
                    <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${phase === "preparing" ? 2 : Math.max(3, progress * 100)}%` }} />
                  </div>
                  {phase === "uploading" && (
                    <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-textSecondary">
                      <span>{formatFileSize(Math.round(fileSize * progress))} / {formatFileSize(fileSize)}</span>
                      <span>Elapsed: {formatDuration(elapsedSeconds)}</span>
                      {remainingSeconds > 0 && <span>About {formatDuration(remainingSeconds)} left</span>}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-textMuted">
                    {operation === "local" ? "The full match is not being uploaded." : "Keep this window open until the upload is complete."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
