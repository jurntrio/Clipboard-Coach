import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import appIconUrl from "../assets/app-icon.png";

const playableExtensions = new Set([".mp4", ".m4v", ".mov", ".webm", ".ogg"]);
const tagColors = ["#68d51b", "#3aa7ff", "#ffb020", "#d66bff", "#ff6b6b", "#4dd8c8", "#f07db1"];

type Screen = "home" | "teams" | "video" | "clips";

function emptyStore(): AppStore {
  return { teams: [], videos: {}, clips: [] };
}

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

function getTagColor(label: string) {
  const normalized = label.trim().toLowerCase();
  let hash = 0;

  for (const character of normalized) {
    hash = (hash * 31 + character.charCodeAt(0)) % tagColors.length;
  }

  return tagColors[Math.abs(hash) % tagColors.length];
}

function normalizeTag(tag: VideoTag): VideoTag {
  return {
    ...tag,
    startTime: tag.startTime ?? tag.time,
    endTime: tag.endTime ?? tag.time,
    color: tag.color ?? getTagColor(tag.label)
  };
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [store, setStore] = useState<AppStore>(emptyStore);
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [tags, setTags] = useState<VideoTag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [tagText, setTagText] = useState("");
  const [teamText, setTeamText] = useState("");
  const [playerTextByTeam, setPlayerTextByTeam] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState("Choose a section from the start page.");
  const [videoError, setVideoError] = useState("");
  const [supportWarning, setSupportWarning] = useState("");
  const [videoReady, setVideoReady] = useState(false);

  const sortedTags = useMemo(
    () => [...tags].map(normalizeTag).sort((first, second) => first.time - second.time),
    [tags]
  );
  const previousVideos = useMemo(
    () =>
      Object.values(store.videos).sort(
        (first, second) =>
          new Date(second.lastOpenedAt).getTime() - new Date(first.lastOpenedAt).getTime()
      ),
    [store.videos]
  );
  const selectedTag = sortedTags.find((tag) => tag.id === selectedTagId) ?? null;

  useEffect(() => {
    window.clipboardCoach.loadStore().then((loadedStore) => setStore(loadedStore));
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, video]);

  useEffect(() => {
    if (!video) {
      return;
    }

    window.clipboardCoach.loadTags(video.path).then((savedTags) => {
      const normalizedTags = savedTags.map(normalizeTag);
      setTags(normalizedTags);
      setSelectedTagId(normalizedTags[0]?.id ?? null);
      setStatus(normalizedTags.length > 0 ? "Saved tags loaded for this video." : "No saved tags yet.");
      refreshStore();
    });
  }, [video]);

  async function refreshStore() {
    const nextStore = await window.clipboardCoach.loadStore();
    setStore(nextStore);
    return nextStore;
  }

  async function persistStore(nextStore: AppStore) {
    const savedStore = await window.clipboardCoach.saveStore(nextStore);
    setStore(savedStore);
  }

  async function openVideo() {
    const selectedVideo = await window.clipboardCoach.openVideo();

    if (!selectedVideo) {
      return;
    }

    prepareVideo(selectedVideo);
    await refreshStore();
  }

  async function openPreviousVideo(videoPath: string) {
    try {
      const selectedVideo = await window.clipboardCoach.openVideoFromPath(videoPath);
      prepareVideo(selectedVideo);
    } catch (error) {
      console.error("Previous video could not be opened:", videoPath, error);
      setStatus("That previous video file could not be found on disk.");
    }
  }

  function prepareVideo(selectedVideo: VideoFile) {
    console.info("Selected video returned from Electron:", selectedVideo);
    setScreen("video");
    setVideo(selectedVideo);
    setTags([]);
    setSelectedTagId(null);
    setTagText("");
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setPlaybackRate(1);
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

  async function playVideo() {
    const player = videoRef.current;

    if (!player) {
      return;
    }

    try {
      await player.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Video playback failed:", { video, source: video?.url, error });
      setVideoError("Playback could not start. The file may use an unsupported codec.");
      setIsPlaying(false);
    }
  }

  function pauseVideo() {
    videoRef.current?.pause();
    setIsPlaying(false);
  }

  function seekBy(offsetSeconds: number) {
    seekTo(currentTime + offsetSeconds);
  }

  function speedUp() {
    const nextRate = playbackRate >= 2 ? 1 : playbackRate + 0.25;
    setPlaybackRate(nextRate);
    setStatus(`Playback speed set to ${nextRate}x.`);
  }

  async function saveTags(nextTags: VideoTag[]) {
    if (!video) {
      return;
    }

    const normalizedTags = nextTags.map(normalizeTag);
    const savedTags = await window.clipboardCoach.saveTags(video.path, normalizedTags);
    setTags(savedTags.map(normalizeTag));
    setStatus(`Saved ${savedTags.length} ${savedTags.length === 1 ? "tag" : "tags"} locally.`);
    await refreshStore();
  }

  async function addTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!video || !videoRef.current || tagText.trim().length === 0) {
      return;
    }

    const label = tagText.trim();
    const currentVideoTime = videoRef.current.currentTime;
    const nextTag: VideoTag = {
      id: crypto.randomUUID(),
      time: currentVideoTime,
      startTime: Math.max(0, currentVideoTime - 2),
      endTime: Math.min(duration || currentVideoTime + 2, currentVideoTime + 2),
      label,
      color: getTagColor(label),
      createdAt: new Date().toISOString()
    };
    const nextTags = [...tags, nextTag];

    setSelectedTagId(nextTag.id);
    setTagText("");
    await saveTags(nextTags);
  }

  async function updateTag(tagId: string, changes: Partial<VideoTag>) {
    const nextTags = tags.map((tag) => {
      if (tag.id !== tagId) {
        return tag;
      }

      const nextTag = { ...normalizeTag(tag), ...changes };
      return {
        ...nextTag,
        color: changes.label ? getTagColor(changes.label) : nextTag.color
      };
    });

    await saveTags(nextTags);
  }

  function jumpToTag(tag: VideoTag) {
    setSelectedTagId(tag.id);
    seekTo(tag.time);
  }

  function seekTo(time: number) {
    const nextTime = Math.min(Math.max(time, 0), duration || 0);

    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
    }

    setCurrentTime(nextTime);
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

  async function createTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (teamText.trim().length === 0) {
      return;
    }

    const nextStore = {
      ...store,
      teams: [
        ...store.teams,
        {
          id: crypto.randomUUID(),
          name: teamText.trim(),
          players: [],
          createdAt: new Date().toISOString()
        }
      ]
    };

    setTeamText("");
    await persistStore(nextStore);
  }

  async function deleteTeam(teamId: string) {
    await persistStore({ ...store, teams: store.teams.filter((team) => team.id !== teamId) });
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>, teamId: string) {
    event.preventDefault();
    const playerName = (playerTextByTeam[teamId] ?? "").trim();

    if (playerName.length === 0) {
      return;
    }

    const nextStore = {
      ...store,
      teams: store.teams.map((team) =>
        team.id === teamId
          ? {
              ...team,
              players: [
                ...team.players,
                { id: crypto.randomUUID(), name: playerName, createdAt: new Date().toISOString() }
              ]
            }
          : team
      )
    };

    setPlayerTextByTeam((current) => ({ ...current, [teamId]: "" }));
    await persistStore(nextStore);
  }

  async function deletePlayer(teamId: string, playerId: string) {
    await persistStore({
      ...store,
      teams: store.teams.map((team) =>
        team.id === teamId
          ? { ...team, players: team.players.filter((player) => player.id !== playerId) }
          : team
      )
    });
  }

  function renderHome() {
    return (
      <main className="homeShell">
        <section className="homeHero">
          <img src={appIconUrl} alt="" />
          <div>
            <h1>Clipboard Coach Studio</h1>
            <p>Local video review, teams, and clips library.</p>
          </div>
        </section>

        <section className="homeCards" aria-label="Start page navigation">
          <button type="button" className="homeCard" onClick={() => setScreen("teams")}>
            <strong>Teams</strong>
            <span>Create teams and simple player lists.</span>
          </button>
          <button type="button" className="homeCard" onClick={() => setScreen("video")}>
            <strong>Video Viewer</strong>
            <span>Open a new video or review saved videos.</span>
          </button>
          <button type="button" className="homeCard" onClick={() => setScreen("clips")}>
            <strong>Clips</strong>
            <span>View prepared clip records when they exist.</span>
          </button>
        </section>
      </main>
    );
  }

  function renderTeams() {
    return (
      <main className="sectionShell">
        <Header title="Teams" subtitle="Simple local team and player lists." onBack={() => setScreen("home")} />

        <form className="sectionForm" onSubmit={createTeam}>
          <input
            value={teamText}
            onChange={(event) => setTeamText(event.target.value)}
            placeholder="Team name"
            aria-label="Team name"
          />
          <button type="submit">Create Team</button>
        </form>

        <section className="teamGrid">
          {store.teams.length === 0 ? <div className="emptyPanel">No teams yet.</div> : null}
          {store.teams.map((team) => (
            <article className="teamCard" key={team.id}>
              <div className="cardHeader">
                <h2>{team.name}</h2>
                <button type="button" onClick={() => deleteTeam(team.id)}>
                  Delete
                </button>
              </div>
              <form className="sectionForm compactForm" onSubmit={(event) => addPlayer(event, team.id)}>
                <input
                  value={playerTextByTeam[team.id] ?? ""}
                  onChange={(event) =>
                    setPlayerTextByTeam((current) => ({ ...current, [team.id]: event.target.value }))
                  }
                  placeholder="Player name"
                  aria-label={`Player name for ${team.name}`}
                />
                <button type="submit">Add</button>
              </form>
              <ol className="playerList">
                {team.players.map((player) => (
                  <li key={player.id}>
                    <span>{player.name}</span>
                    <button type="button" onClick={() => deletePlayer(team.id, player.id)}>
                      Delete
                    </button>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      </main>
    );
  }

  function renderClips() {
    return (
      <main className="sectionShell">
        <Header title="Clips" subtitle="Prepared local clip library. Export comes later." onBack={() => setScreen("home")} />
        <section className="clipGrid">
          {store.clips.length === 0 ? (
            <div className="emptyPanel">No clip records yet. Build 1.3 prepares the library screen only.</div>
          ) : null}
          {store.clips.map((clip) => (
            <article className={clip.missing ? "clipCard missingClip" : "clipCard"} key={clip.id}>
              <h2>{clip.name}</h2>
              <p>{shortenPath(clip.filePath)}</p>
              <span>{clip.missing ? "File missing" : "Available"}</span>
            </article>
          ))}
        </section>
      </main>
    );
  }

  function renderVideoViewer() {
    return (
      <main className="appShell">
        <aside className="controlPanel" aria-label="Basic controls">
          <div className="brandBlock">
            <img src={appIconUrl} alt="" />
            <div>
              <h1>Video Viewer</h1>
              <p>Build 1.3</p>
            </div>
          </div>

          <button type="button" onClick={() => setScreen("home")}>
            Home
          </button>
          <button className="primaryButton" type="button" onClick={openVideo}>
            Open New Video
          </button>

          <section className="previousBlock" aria-label="Previous videos">
            <h2>Previous Videos</h2>
            {previousVideos.length === 0 ? <p>No previous videos yet.</p> : null}
            {previousVideos.map((previousVideo) => (
              <button
                className="previousVideoButton"
                type="button"
                key={previousVideo.path}
                onClick={() => openPreviousVideo(previousVideo.path)}
              >
                <strong>{previousVideo.name}</strong>
                <span>{previousVideo.tags.length} saved tags</span>
                {previousVideo.tags.length > 0 ? (
                  <small>{previousVideo.tags.slice(0, 4).map((tag) => tag.label).join(", ")}</small>
                ) : null}
              </button>
            ))}
          </section>

          <form className="tagForm" onSubmit={addTag}>
            <label htmlFor="tagText">Tag current moment</label>
            <input
              id="tagText"
              value={tagText}
              onChange={(event) => setTagText(event.target.value)}
              disabled={!video}
              placeholder="Example: good pass"
              aria-label="Tag text"
            />
            <button type="submit" disabled={!video || tagText.trim().length === 0}>
              Add Tag
            </button>
          </form>

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
            </div>
          ) : null}

          {supportWarning ? <div className="warningMessage">{supportWarning}</div> : null}
          {videoError ? <div className="errorMessage">{videoError}</div> : null}

          <div className="transportDock" aria-label="Playback controls">
            <button type="button" onClick={() => seekBy(-5)} disabled={!video}>
              &lt;
            </button>
            <button type="button" onClick={playVideo} disabled={!video || !!videoError}>
              &gt;
            </button>
            <button type="button" onClick={pauseVideo} disabled={!video}>
              ||
            </button>
            <button type="button" onClick={speedUp} disabled={!video}>
              &gt;&gt;
            </button>
            <span>{playbackRate}x</span>
          </div>

          <p className="statusLine" role="status">
            {status}
          </p>
        </aside>

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
                setDuration(event.currentTarget.duration || 0);
                setStatus(`Video loaded: ${video.name}.`);
              }}
              onError={handleVideoError}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onRateChange={(event) => setPlaybackRate(event.currentTarget.playbackRate)}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              controls={false}
            />
          ) : (
            <div className="emptyVideo">
              <strong>No video open</strong>
              <span>Open a new video or choose a previous video from the left.</span>
            </div>
          )}
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
                  <button
                    type="button"
                    className={tag.id === selectedTagId ? "selectedTag" : ""}
                    onClick={() => jumpToTag(tag)}
                  >
                    <i style={{ background: tag.color }} />
                    <time>{formatTime(tag.time)}</time>
                    <span>{tag.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="emptyTags">Tags you add will appear here and reload for this video.</div>
          )}

          {selectedTag ? (
            <div className="tagEditor">
              <h3>Selected Tag</h3>
              <label>
                Name
                <input
                  value={selectedTag.label}
                  onChange={(event) => updateTag(selectedTag.id, { label: event.target.value })}
                />
              </label>
              <label>
                Start
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={(selectedTag.startTime ?? selectedTag.time).toFixed(1)}
                  onChange={(event) =>
                    updateTag(selectedTag.id, { startTime: Math.max(0, Number(event.target.value)) })
                  }
                />
              </label>
              <label>
                End
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={(selectedTag.endTime ?? selectedTag.time).toFixed(1)}
                  onChange={(event) =>
                    updateTag(selectedTag.id, { endTime: Math.max(0, Number(event.target.value)) })
                  }
                />
              </label>
            </div>
          ) : null}
        </aside>

        <section className="timelinePanel" aria-label="Video timeline">
          <div className="timelineTimes">
            <span>{formatTime(currentTime)}</span>
            <strong>{video ? video.name : videoReady ? "Ready" : "No video selected"}</strong>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="timelineTrack">
            {duration > 0
              ? sortedTags.map((tag) => (
                  <button
                    key={tag.id}
                    className={tag.id === selectedTagId ? "tagMarker activeMarker" : "tagMarker"}
                    type="button"
                    style={{
                      left: `${Math.min(100, Math.max(0, (tag.time / duration) * 100))}%`,
                      background: tag.color
                    }}
                    title={`${formatTime(tag.time)} - ${tag.label}`}
                    aria-label={`Jump to ${tag.label} at ${formatTime(tag.time)}`}
                    onClick={() => jumpToTag(tag)}
                  />
                ))
              : null}
            <input
              type="range"
              min="0"
              max={duration || 0}
              step="0.01"
              value={Math.min(currentTime, duration || 0)}
              disabled={!video || duration <= 0}
              onChange={(event) => seekTo(Number(event.currentTarget.value))}
              aria-label="Video timeline"
            />
          </div>
        </section>
      </main>
    );
  }

  if (screen === "teams") {
    return renderTeams();
  }

  if (screen === "video") {
    return renderVideoViewer();
  }

  if (screen === "clips") {
    return renderClips();
  }

  return renderHome();
}

type HeaderProps = {
  title: string;
  subtitle: string;
  onBack: () => void;
};

function Header({ title, subtitle, onBack }: HeaderProps) {
  return (
    <header className="sectionHeader">
      <button type="button" onClick={onBack}>
        Home
      </button>
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}

export default App;
