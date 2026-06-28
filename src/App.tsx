import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const playableExtensions = new Set([".mp4", ".m4v", ".mov", ".webm", ".ogg"]);

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function shortenPath(filePath: string) {
  if (filePath.length <= 72) {
    return filePath;
  }

  return `${filePath.slice(0, 32)}...${filePath.slice(-32)}`;
}

function getVideoErrorMessage(error: MediaError | null) {
  switch (error?.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "Video loading was cancelled.";
    case MediaError.MEDIA_ERR_NETWORK:
      return "The video file could not be read from disk.";
    case MediaError.MEDIA_ERR_DECODE:
      return "The video file loaded, but this format or codec could not be decoded.";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "This video format or codec is not supported by the built-in player.";
    default:
      return "The video could not be loaded. Try a standard MP4 file encoded with H.264 video and AAC audio.";
  }
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [tags, setTags] = useState<VideoTag[]>([]);
  const [tagText, setTagText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [status, setStatus] = useState("Open a local video file to begin.");
  const [videoError, setVideoError] = useState("");
  const [supportWarning, setSupportWarning] = useState("");
  const [videoReady, setVideoReady] = useState(false);

  const sortedTags = useMemo(
    () => [...tags].sort((first, second) => first.time - second.time),
    [tags]
  );

  useEffect(() => {
    if (!video) {
      return;
    }

    window.clipboardCoach.loadTags(video.path).then((savedTags) => {
      setTags(savedTags);
      setStatus(savedTags.length > 0 ? "Saved tags loaded for this video." : "No saved tags yet.");
    });
  }, [video]);

  async function openVideo() {
    const selectedVideo = await window.clipboardCoach.openVideo();

    if (!selectedVideo) {
      return;
    }

    console.info("Selected video returned from Electron:", selectedVideo);
    setVideo(selectedVideo);
    setTags([]);
    setTagText("");
    setCurrentTime(0);
    setIsPlaying(false);
    setVideoError("");
    setVideoReady(false);

    const playerProbe = document.createElement("video");
    const canPlayMp4 = playerProbe.canPlayType("video/mp4");
    const isLikelySupported = playableExtensions.has(selectedVideo.extension);

    setSupportWarning(
      isLikelySupported
        ? ""
        : "This file extension is often not supported by the built-in player. If it fails, try an MP4 encoded with H.264 video and AAC audio."
    );
    setStatus(
      `Opened ${selectedVideo.name}. ${canPlayMp4 ? "MP4 playback is supported." : "MP4 support was not reported by the player."}`
    );
  }

  async function togglePlayback() {
    const player = videoRef.current;

    if (!player) {
      return;
    }

    if (player.paused) {
      try {
        await player.play();
        setIsPlaying(true);
      } catch (error) {
        console.error("Video playback failed:", {
          video,
          source: video?.url,
          error
        });
        setVideoError("Playback could not start. The file may use an unsupported codec.");
        setIsPlaying(false);
      }
    } else {
      player.pause();
      setIsPlaying(false);
    }
  }

  async function saveTags(nextTags: VideoTag[]) {
    if (!video) {
      return;
    }

    await window.clipboardCoach.saveTags(video.path, nextTags);
    setStatus(`Saved ${nextTags.length} ${nextTags.length === 1 ? "tag" : "tags"} locally.`);
  }

  async function addTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!video || !videoRef.current || tagText.trim().length === 0) {
      return;
    }

    const nextTag: VideoTag = {
      id: crypto.randomUUID(),
      time: videoRef.current.currentTime,
      label: tagText.trim(),
      createdAt: new Date().toISOString()
    };
    const nextTags = [...tags, nextTag];

    setTags(nextTags);
    setTagText("");
    await saveTags(nextTags);
  }

  function jumpToTag(tag: VideoTag) {
    if (!videoRef.current) {
      return;
    }

    videoRef.current.currentTime = tag.time;
    setCurrentTime(tag.time);
  }

  function handleVideoError() {
    const player = videoRef.current;
    const message = getVideoErrorMessage(player?.error ?? null);

    console.error("Video load error:", {
      file: video,
      source: video?.url,
      mediaError: player?.error ?? null,
      networkState: player?.networkState,
      readyState: player?.readyState
    });
    setVideoError(message);
    setVideoReady(false);
    setIsPlaying(false);
    setStatus("Video failed to load.");
  }

  return (
    <main className="appShell">
      <section className="workspace">
        <div className="topBar">
          <div>
            <h1>Clipboard Coach Studio</h1>
            <p>{video ? video.name : "Build 1 video tagging"}</p>
          </div>
          <button className="primaryButton" type="button" onClick={openVideo}>
            Open Video
          </button>
        </div>

        <div className="contentGrid">
          <section className="videoPanel" aria-label="Video player">
            {video ? (
              <video
                key={video.url}
                ref={videoRef}
                className="videoPlayer"
                src={video.url}
                preload="metadata"
                onCanPlay={() => {
                  setVideoReady(true);
                  setVideoError("");
                }}
                onLoadedMetadata={(event) => {
                  setCurrentTime(event.currentTarget.currentTime);
                  setStatus(`Video loaded: ${video.name}.`);
                }}
                onError={handleVideoError}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                controls={false}
              />
            ) : (
              <div className="emptyVideo">
                <strong>No video open</strong>
                <span>Choose a local video file from your computer.</span>
              </div>
            )}

            {video ? (
              <div className="videoDetails" aria-label="Selected video details">
                <div>
                  <span>File</span>
                  <strong>{video.name}</strong>
                </div>
                <div>
                  <span>Path</span>
                  <code title={video.path}>{shortenPath(video.path)}</code>
                </div>
                <div>
                  <span>Source</span>
                  <code title={video.url}>{shortenPath(video.url)}</code>
                </div>
              </div>
            ) : null}

            {supportWarning ? <div className="warningMessage">{supportWarning}</div> : null}
            {videoError ? <div className="errorMessage">{videoError}</div> : null}

            <div className="controlBar">
              <button type="button" onClick={togglePlayback} disabled={!video || !!videoError}>
                {isPlaying ? "Pause" : "Play"}
              </button>
              <span className="timeReadout">{formatTime(currentTime)}</span>
              {video ? (
                <span className="loadState">{videoReady ? "Ready" : videoError ? "Not loaded" : "Loading"}</span>
              ) : null}
            </div>

            <form className="tagForm" onSubmit={addTag}>
              <input
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
                disabled={!video}
                placeholder="Tag this moment"
                aria-label="Tag text"
              />
              <button type="submit" disabled={!video || tagText.trim().length === 0}>
                Add Tag
              </button>
            </form>

            <p className="statusLine" role="status">
              {status}
            </p>
          </section>

          <aside className="tagPanel" aria-label="Timestamped tags">
            <div className="panelHeader">
              <h2>Tags</h2>
              <span>{tags.length}</span>
            </div>

            {sortedTags.length > 0 ? (
              <ol className="tagList">
                {sortedTags.map((tag) => (
                  <li key={tag.id}>
                    <button type="button" onClick={() => jumpToTag(tag)}>
                      <time>{formatTime(tag.time)}</time>
                      <span>{tag.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="emptyTags">Tags you add will appear here and reload for this video.</div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

export default App;
