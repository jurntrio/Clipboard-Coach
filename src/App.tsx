import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [tags, setTags] = useState<VideoTag[]>([]);
  const [tagText, setTagText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [status, setStatus] = useState("Open a local video file to begin.");

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

    setVideo(selectedVideo);
    setTags([]);
    setTagText("");
    setCurrentTime(0);
    setIsPlaying(false);
    setStatus(`Opened ${selectedVideo.name}.`);
  }

  async function togglePlayback() {
    const player = videoRef.current;

    if (!player) {
      return;
    }

    if (player.paused) {
      await player.play();
      setIsPlaying(true);
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
                ref={videoRef}
                className="videoPlayer"
                src={video.url}
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

            <div className="controlBar">
              <button type="button" onClick={togglePlayback} disabled={!video}>
                {isPlaying ? "Pause" : "Play"}
              </button>
              <span className="timeReadout">{formatTime(currentTime)}</span>
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
