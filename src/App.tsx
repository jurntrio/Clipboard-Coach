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

function formatClockTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseClockTime(value: string) {
  const parts = value.split(":").map((part) => Number.parseInt(part, 10));

  if (parts.some((part) => Number.isNaN(part) || part < 0)) {
    return null;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return null;
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
  const startTime = tag.startTime ?? tag.time;

  return {
    ...tag,
    startTime,
    endTime: tag.endTime ?? startTime + 5,
    color: tag.color ?? getTagColor(tag.label)
  };
}

function getPlayerDisplayName(player: Player) {
  const fullName = `${player.firstName ?? ""} ${player.lastName ?? ""}`.trim();
  return fullName || player.name || "Unnamed player";
}

function getSortedPlayers(players: Player[]) {
  return [...players].sort((first, second) => {
    const firstLast = (first.lastName || first.name || first.firstName || "").toLowerCase();
    const secondLast = (second.lastName || second.name || second.firstName || "").toLowerCase();
    const lastCompare = firstLast.localeCompare(secondLast);

    if (lastCompare !== 0) {
      return lastCompare;
    }

    return (first.firstName || "").toLowerCase().localeCompare((second.firstName || "").toLowerCase());
  });
}

function getTagLanes(tags: VideoTag[]) {
  const laneEnds: number[] = [];

  return tags.map((tag) => {
    const normalizedTag = normalizeTag(tag);
    const startTime = normalizedTag.startTime ?? normalizedTag.time;
    const endTime = Math.max(startTime + 0.25, normalizedTag.endTime ?? startTime + 5);
    let laneIndex = laneEnds.findIndex((laneEnd) => startTime >= laneEnd);

    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(endTime);
    } else {
      laneEnds[laneIndex] = endTime;
    }

    return { tag: normalizedTag, laneIndex, startTime, endTime };
  });
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [store, setStore] = useState<AppStore>(emptyStore);
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [tags, setTags] = useState<VideoTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [expandedTagIds, setExpandedTagIds] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState({ label: "", startTime: "00:00:00", endTime: "00:00:05" });
  const [tagDraftError, setTagDraftError] = useState("");
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [newTagText, setNewTagText] = useState("");
  const [teamText, setTeamText] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [playerDraftByTeam, setPlayerDraftByTeam] = useState<
    Record<string, { firstName: string; lastName: string; email: string }>
  >({});
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
  const selectedTag = sortedTags.find((tag) => tag.id === selectedTagIds[0]) ?? null;
  const timelineTags = useMemo(() => getTagLanes(sortedTags), [sortedTags]);
  const timelineLaneCount = Math.max(1, ...timelineTags.map((tag) => tag.laneIndex + 1));
  const selectedTeam = store.teams.find((team) => team.id === selectedTeamId) ?? store.teams[0] ?? null;

  useEffect(() => {
    window.clipboardCoach.loadStore().then((loadedStore) => setStore(loadedStore));
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, video]);

  useEffect(() => {
    if (!selectedTag) {
      setTagDraft({ label: "", startTime: "00:00:00", endTime: "00:00:05" });
      setTagDraftError("");
      return;
    }

    setTagDraft({
      label: selectedTag.label,
      startTime: formatClockTime(selectedTag.startTime ?? selectedTag.time),
      endTime: formatClockTime(selectedTag.endTime ?? (selectedTag.startTime ?? selectedTag.time) + 5)
    });
    setTagDraftError("");
  }, [selectedTag?.id]);

  useEffect(() => {
    if (selectedTeamId && store.teams.some((team) => team.id === selectedTeamId)) {
      return;
    }

    setSelectedTeamId(store.teams[0]?.id ?? null);
  }, [selectedTeamId, store.teams]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if (event.code !== "Space" || isTyping || screen !== "video" || !video) {
        return;
      }

      event.preventDefault();
      openAddTagModal();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen, video, currentTime]);

  useEffect(() => {
    if (!video) {
      return;
    }

    window.clipboardCoach.loadTags(video.path).then((savedTags) => {
      const normalizedTags = savedTags.map(normalizeTag);
      setTags(normalizedTags);
      setSelectedTagIds(normalizedTags[0] ? [normalizedTags[0].id] : []);
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
    setSelectedTagIds([]);
    setNewTagText("");
    setIsAddTagOpen(false);
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
      player.playbackRate = 1;
      setPlaybackRate(1);
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

  function openAddTagModal() {
    if (!video || !videoRef.current) {
      return;
    }

    pauseVideo();
    setNewTagText("");
    setIsAddTagOpen(true);
  }

  async function confirmAddTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!video || !videoRef.current || newTagText.trim().length === 0) {
      return;
    }

    const label = newTagText.trim();
    const currentVideoTime = videoRef.current.currentTime;
    const nextTag: VideoTag = {
      id: crypto.randomUUID(),
      time: currentVideoTime,
      startTime: currentVideoTime,
      endTime: Math.min(duration || currentVideoTime + 5, currentVideoTime + 5),
      label,
      color: getTagColor(label),
      createdAt: new Date().toISOString()
    };
    const nextTags = [...tags, nextTag];

    setSelectedTagIds([nextTag.id]);
    setExpandedTagIds([nextTag.id]);
    setNewTagText("");
    setIsAddTagOpen(false);
    await saveTags(nextTags);
  }

  function selectTag(tagId: string) {
    setSelectedTagIds((current) => (current.includes(tagId) ? current : [tagId, ...current]));
  }

  function jumpToTagStart(tag: VideoTag) {
    setSelectedTagIds((current) => (current.includes(tag.id) ? current : [tag.id, ...current]));
    seekTo(tag.startTime ?? tag.time);
  }

  function toggleTagSelection(tagId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [tagId, ...current]
    );
  }

  async function saveSelectedTagDraft() {
    if (!selectedTag) {
      return;
    }

    const label = tagDraft.label.trim() || selectedTag.label;
    const parsedStart = parseClockTime(tagDraft.startTime);
    const parsedEnd = parseClockTime(tagDraft.endTime);

    if (parsedStart === null || parsedEnd === null) {
      setTagDraftError("Use HH:MM:SS for start and end.");
      return;
    }

    const startTime = Math.max(0, parsedStart);
    const endTime = parsedEnd;

    if (endTime <= startTime) {
      setTagDraftError("End time must be after start time.");
      return;
    }

    if (duration > 0 && endTime > duration) {
      setTagDraftError("End time cannot be after the video duration.");
      return;
    }

    const nextTags = tags.map((tag) =>
      tag.id === selectedTag.id
        ? {
            ...normalizeTag(tag),
            label,
            time: startTime,
            startTime,
            endTime,
            color: getTagColor(label)
          }
        : tag
    );

    await saveTags(nextTags);
    setTagDraftError("");
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
    setSelectedTeamId(nextStore.teams[nextStore.teams.length - 1].id);
    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function deleteTeam(teamId: string) {
    const nextStore = { ...store, teams: store.teams.filter((team) => team.id !== teamId) };
    setSelectedTeamId(nextStore.teams[0]?.id ?? null);
    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>, teamId: string) {
    event.preventDefault();
    const playerDraft = playerDraftByTeam[teamId] ?? { firstName: "", lastName: "", email: "" };
    const firstName = playerDraft.firstName.trim();
    const lastName = playerDraft.lastName.trim();
    const email = playerDraft.email.trim();

    if (firstName.length === 0 && lastName.length === 0) {
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
                {
                  id: crypto.randomUUID(),
                  firstName,
                  lastName,
                  email,
                  name: `${firstName} ${lastName}`.trim(),
                  createdAt: new Date().toISOString()
                }
              ]
            }
          : team
      )
    };

    setPlayerDraftByTeam((current) => ({ ...current, [teamId]: { firstName: "", lastName: "", email: "" } }));
    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function deletePlayer(teamId: string, playerId: string) {
    const nextStore = {
      ...store,
      teams: store.teams.map((team) =>
        team.id === teamId
          ? { ...team, players: team.players.filter((player) => player.id !== playerId) }
          : team
      )
    };
    setStore(nextStore);
    await persistStore(nextStore);
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
    const sortedPlayers = getSortedPlayers(selectedTeam?.players ?? []);
    const selectedPlayerDraft = selectedTeam
      ? playerDraftByTeam[selectedTeam.id] ?? { firstName: "", lastName: "", email: "" }
      : { firstName: "", lastName: "", email: "" };

    return (
      <main className="sectionShell">
        <Header title="Teams" subtitle="Simple local team and player lists." onBack={() => setScreen("home")} />

        <section className="teamsLayout">
          <aside className="teamsListPanel">
            <form className="sectionForm teamCreateForm" onSubmit={createTeam}>
              <input
                value={teamText}
                onChange={(event) => setTeamText(event.target.value)}
                placeholder="Team name"
                aria-label="Team name"
              />
              <button type="submit">Create Team</button>
            </form>

            <div className="verticalTeamList">
              {store.teams.length === 0 ? <div className="emptyPanel">No teams yet.</div> : null}
              {store.teams.map((team) => (
                <button
                  className={team.id === selectedTeam?.id ? "teamSelectButton activeTeam" : "teamSelectButton"}
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                >
                  <strong>{team.name}</strong>
                  <span>{team.players.length} players</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="selectedTeamPanel">
            {selectedTeam ? (
              <>
                <div className="cardHeader">
                  <div>
                    <h2>{selectedTeam.name}</h2>
                    <p>Players sorted by last name, then first name.</p>
                  </div>
                  <button type="button" onClick={() => deleteTeam(selectedTeam.id)}>
                    Delete Team
                  </button>
                </div>

                <form className="playerForm" onSubmit={(event) => addPlayer(event, selectedTeam.id)}>
                  <input
                    value={selectedPlayerDraft.firstName}
                    onChange={(event) =>
                      setPlayerDraftByTeam((current) => ({
                        ...current,
                        [selectedTeam.id]: { ...selectedPlayerDraft, firstName: event.target.value }
                      }))
                    }
                    placeholder="First name"
                    aria-label="Player first name"
                  />
                  <input
                    value={selectedPlayerDraft.lastName}
                    onChange={(event) =>
                      setPlayerDraftByTeam((current) => ({
                        ...current,
                        [selectedTeam.id]: { ...selectedPlayerDraft, lastName: event.target.value }
                      }))
                    }
                    placeholder="Last name"
                    aria-label="Player last name"
                  />
                  <input
                    value={selectedPlayerDraft.email}
                    onChange={(event) =>
                      setPlayerDraftByTeam((current) => ({
                        ...current,
                        [selectedTeam.id]: { ...selectedPlayerDraft, email: event.target.value }
                      }))
                    }
                    placeholder="Email optional"
                    aria-label="Player email"
                  />
                  <button type="submit">Add Player</button>
                </form>

                <ol className="playerList">
                  {sortedPlayers.map((player) => (
                    <li key={player.id}>
                      <div>
                        <strong>{getPlayerDisplayName(player)}</strong>
                        {player.email ? <span>{player.email}</span> : null}
                        <small>No clips linked to this player yet.</small>
                      </div>
                      <button type="button" onClick={() => deletePlayer(selectedTeam.id, player.id)}>
                        Delete
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <div className="emptyPanel">Select or create a team to manage players.</div>
            )}
          </section>
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

          <div className="tagForm">
            <label>Add a tag at the current video time</label>
            <button type="button" onClick={openAddTagModal} disabled={!video}>
              Add Tag
            </button>
            <small>Space pauses the video and opens this popup.</small>
          </div>

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
              &#9654;
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
                  <div className={selectedTagIds.includes(tag.id) ? "tagRow selectedTag" : "tagRow"}>
                    <button
                      className="selectCircle"
                      type="button"
                      aria-label={`Select ${tag.label}`}
                      aria-pressed={selectedTagIds.includes(tag.id)}
                      onClick={() => toggleTagSelection(tag.id)}
                    />
                    <button
                      className="tagJumpButton"
                      type="button"
                      onClick={() => selectTag(tag.id)}
                      onDoubleClick={() => jumpToTagStart(tag)}
                    >
                      <i style={{ background: tag.color }} />
                      <time>{formatClockTime(tag.startTime ?? tag.time)}</time>
                      <span>{tag.label}</span>
                    </button>
                    <button
                      className="tagExpandButton"
                      type="button"
                      onClick={() =>
                        setExpandedTagIds((current) =>
                          current.includes(tag.id)
                            ? current.filter((expandedTagId) => expandedTagId !== tag.id)
                            : [...current, tag.id]
                        )
                      }
                    >
                      {expandedTagIds.includes(tag.id) ? "Hide" : "Details"}
                    </button>
                    {expandedTagIds.includes(tag.id) ? (
                      <div className="inlineTagDetails">
                        <span>{tag.label}</span>
                        <span>
                          {formatClockTime(tag.startTime ?? tag.time)} -{" "}
                          {formatClockTime(tag.endTime ?? (tag.startTime ?? tag.time) + 5)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="emptyTags">Tags you add will appear here and reload for this video.</div>
          )}

          {selectedTagIds.length > 1 ? (
            <div className="tagEditor mutedEditor">Select only one tag to edit.</div>
          ) : selectedTag ? (
            <div className="tagEditor">
              <h3>Selected Tag</h3>
              <label>
                Name
                <input
                  value={tagDraft.label}
                  onChange={(event) => setTagDraft((current) => ({ ...current, label: event.target.value }))}
                />
              </label>
              <label>
                Start
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={tagDraft.startTime}
                  onChange={(event) => setTagDraft((current) => ({ ...current, startTime: event.target.value }))}
                />
              </label>
              <label>
                End
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={tagDraft.endTime}
                  onChange={(event) => setTagDraft((current) => ({ ...current, endTime: event.target.value }))}
                />
              </label>
              <button type="button" onClick={saveSelectedTagDraft}>
                Save Tag Times
              </button>
              {tagDraftError ? <p className="fieldError">{tagDraftError}</p> : null}
            </div>
          ) : null}
        </aside>

        <section className="timelinePanel" aria-label="Video timeline">
          <div className="timelineTimes">
            <span>{formatTime(currentTime)}</span>
            <strong>{video ? video.name : videoReady ? "Ready" : "No video selected"}</strong>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="timelineTrack" style={{ minHeight: `${Math.max(44, timelineLaneCount * 24 + 28)}px` }}>
            {duration > 0
              ? timelineTags.map(({ tag, laneIndex, startTime, endTime }) => (
                  <button
                    key={tag.id}
                    className={selectedTagIds.includes(tag.id) ? "tagBlock activeMarker" : "tagBlock"}
                    type="button"
                    style={{
                      left: `${Math.min(100, Math.max(0, (startTime / duration) * 100))}%`,
                      width: `${Math.max(1, Math.min(100, ((endTime - startTime) / duration) * 100))}%`,
                      top: `${laneIndex * 24}px`,
                      background: tag.color
                    }}
                    title={`${formatClockTime(startTime)} - ${formatClockTime(endTime)} - ${tag.label}`}
                    aria-label={`Select ${tag.label}; double click to jump to ${formatClockTime(startTime)}`}
                    onClick={() => selectTag(tag.id)}
                    onDoubleClick={() => jumpToTagStart(tag)}
                  >
                    {tag.label}
                  </button>
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

        {isAddTagOpen ? (
          <div className="modalBackdrop" role="presentation">
            <form className="tagModal" onSubmit={confirmAddTag} role="dialog" aria-modal="true" aria-label="Add tag">
              <h2>Add Tag</h2>
              <p>Create a tag at {formatClockTime(currentTime)}.</p>
              <input
                value={newTagText}
                onChange={(event) => setNewTagText(event.target.value)}
                autoFocus
                placeholder="Tag name"
                aria-label="Tag name"
              />
              <div className="modalActions">
                <button type="button" onClick={() => setIsAddTagOpen(false)}>
                  Cancel
                </button>
                <button className="primaryButton" type="submit" disabled={newTagText.trim().length === 0}>
                  Confirm
                </button>
              </div>
            </form>
          </div>
        ) : null}
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
