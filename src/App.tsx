import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import appIconUrl from "../assets/app-icon.png";

const playableExtensions = new Set([".mp4", ".m4v", ".mov", ".webm", ".ogg"]);
const tagColors = ["#68d51b", "#3aa7ff", "#ffb020", "#d66bff", "#ff6b6b", "#4dd8c8", "#f07db1"];

type Screen = "home" | "teams" | "video" | "clips";

function emptyStore(): AppStore {
  return { teams: [], videos: {}, clips: [], settings: { standardTags: ["Start", "Goal"], activeMatchPlayerIds: [] } };
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

function getActiveTagsAtTime(tags: VideoTag[], currentTime: number) {
  const activeNames = tags
    .map(normalizeTag)
    .filter((tag) => {
      const startTime = tag.startTime ?? tag.time;
      const endTime = tag.endTime ?? startTime + 5;
      return currentTime >= startTime && currentTime < endTime;
    })
    .map((tag) => tag.label);

  return [...new Set(activeNames)];
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
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState({ label: "", startTime: "00:00:00", endTime: "00:00:05" });
  const [tagDraftError, setTagDraftError] = useState("");
  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [isStandardTagsModalOpen, setIsStandardTagsModalOpen] = useState(false);
  const [isPreviousVideosModalOpen, setIsPreviousVideosModalOpen] = useState(false);
  const [newTagText, setNewTagText] = useState("");
  const [videoTeamId, setVideoTeamId] = useState("");
  const [activePlayerIds, setActivePlayerIds] = useState<string[]>([]);
  const [matchTeamDraftId, setMatchTeamDraftId] = useState("");
  const [matchPlayerDraftIds, setMatchPlayerDraftIds] = useState<string[]>([]);
  const [quickPlayerDraft, setQuickPlayerDraft] = useState({ firstName: "", lastName: "", email: "" });
  const [standardTags, setStandardTags] = useState(["Start", "Goal"]);
  const [newStandardTagText, setNewStandardTagText] = useState("");
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
  const latestPreviousVideo = previousVideos[0] ?? null;
  const editingTag = sortedTags.find((tag) => tag.id === editingTagId) ?? null;
  const timelineTags = useMemo(() => getTagLanes(sortedTags), [sortedTags]);
  const timelineLaneCount = Math.max(1, ...timelineTags.map((tag) => tag.laneIndex + 1));
  const activeTagNames = useMemo(() => getActiveTagsAtTime(sortedTags, currentTime), [currentTime, sortedTags]);
  const currentVideoRecord = video ? store.videos[video.path] : null;
  const selectedTeam = store.teams.find((team) => team.id === selectedTeamId) ?? store.teams[0] ?? null;
  const videoTeam = store.teams.find((team) => team.id === videoTeamId) ?? null;
  const videoTeamPlayers = useMemo(() => getSortedPlayers(videoTeam?.players ?? []), [videoTeam]);
  const matchDraftTeam = store.teams.find((team) => team.id === matchTeamDraftId) ?? null;
  const matchDraftPlayers = useMemo(() => getSortedPlayers(matchDraftTeam?.players ?? []), [matchDraftTeam]);
  const activePlayers = useMemo(
    () =>
      activePlayerIds
        .map((playerId) => {
          const teamPlayer = videoTeamPlayers.find((player) => player.id === playerId);
          const savedPlayer = currentVideoRecord?.matchState?.players.find((player) => player.id === playerId);

          if (teamPlayer) {
            return teamPlayer;
          }

          if (savedPlayer) {
            return {
              id: savedPlayer.id,
              name: savedPlayer.name,
              firstName: savedPlayer.name,
              lastName: "",
              createdAt: ""
            };
          }

          return null;
        })
        .filter((player): player is Player => player !== null),
    [activePlayerIds, currentVideoRecord?.matchState?.players, videoTeamPlayers]
  );

  useEffect(() => {
    window.clipboardCoach.loadStore().then((loadedStore) => {
      setStore(loadedStore);
      setStandardTags(loadedStore.settings.standardTags.length ? loadedStore.settings.standardTags : ["Start", "Goal"]);
      setVideoTeamId("");
      setActivePlayerIds([]);
    });
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, video]);

  useEffect(() => {
    if (!editingTag) {
      setTagDraft({ label: "", startTime: "00:00:00", endTime: "00:00:05" });
      setTagDraftError("");
      return;
    }

    setTagDraft({
      label: editingTag.label,
      startTime: formatClockTime(editingTag.startTime ?? editingTag.time),
      endTime: formatClockTime(editingTag.endTime ?? (editingTag.startTime ?? editingTag.time) + 5)
    });
    setTagDraftError("");
  }, [editingTag?.id]);

  useEffect(() => {
    if (selectedTeamId && store.teams.some((team) => team.id === selectedTeamId)) {
      return;
    }

    setSelectedTeamId(store.teams[0]?.id ?? null);
  }, [selectedTeamId, store.teams]);

  useEffect(() => {
    if (!videoTeamId || store.teams.some((team) => team.id === videoTeamId)) {
      return;
    }

    setVideoTeamId("");
  }, [videoTeamId, store.teams]);

  useEffect(() => {
    const savedPlayerIds = currentVideoRecord?.matchState?.players.map((player) => player.id) ?? [];
    setActivePlayerIds((current) =>
      current.filter(
        (playerId) => videoTeamPlayers.some((player) => player.id === playerId) || savedPlayerIds.includes(playerId)
      )
    );
  }, [currentVideoRecord?.matchState?.players, videoTeamPlayers]);

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

    window.clipboardCoach.loadTags(video.path).then(async (savedTags) => {
      const normalizedTags = savedTags.map(normalizeTag);
      setTags(normalizedTags);
      setSelectedTagIds(normalizedTags[0] ? [normalizedTags[0].id] : []);
      setStatus(normalizedTags.length > 0 ? "Saved tags loaded for this video." : "No saved tags yet.");
      const nextStore = await refreshStore();
      restoreVideoMatchState(video.path, nextStore);
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

  async function persistSettings(nextSettings: Partial<AppSettings>) {
    const nextStore = {
      ...store,
      settings: {
        ...store.settings,
        ...nextSettings
      }
    };

    setStore(nextStore);
    await persistStore(nextStore);
  }

  function buildMatchState(teamId: string, playerIds: string[], sourceStore = store): MatchState | undefined {
    if (!teamId && playerIds.length === 0) {
      return undefined;
    }

    const team = sourceStore.teams.find((storedTeam) => storedTeam.id === teamId);
    const players = playerIds.map((playerId) => {
      const player = team?.players.find((storedPlayer) => storedPlayer.id === playerId);
      const savedPlayer = currentVideoRecord?.matchState?.players.find((storedPlayer) => storedPlayer.id === playerId);

      return {
        id: playerId,
        name: player ? getPlayerDisplayName(player) : savedPlayer?.name ?? "Saved player"
      };
    });

    return {
      teamId: teamId || undefined,
      teamName: team?.name ?? currentVideoRecord?.matchState?.teamName,
      players
    };
  }

  async function persistVideoMatchState(teamId: string, playerIds: string[], sourceStore = store) {
    if (!video) {
      return;
    }

    const existingVideo = sourceStore.videos[video.path] ?? {
      path: video.path,
      name: video.name,
      extension: video.extension,
      lastOpenedAt: new Date().toISOString(),
      tags
    };
    const nextStore = {
      ...sourceStore,
      videos: {
        ...sourceStore.videos,
        [video.path]: {
          ...existingVideo,
          matchState: buildMatchState(teamId, playerIds, sourceStore)
        }
      }
    };

    setStore(nextStore);
    await persistStore(nextStore);
  }

  function restoreVideoMatchState(videoPath: string, sourceStore: AppStore) {
    const matchState = sourceStore.videos[videoPath]?.matchState;

    setVideoTeamId(matchState?.teamId ?? "");
    setActivePlayerIds(matchState?.players.map((player) => player.id) ?? []);
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
    setEditingTagId(null);
    setExpandedTagIds([]);
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

  async function createTagAtCurrentTime(label: string, playerIds: string[] = []) {
    if (!video || !videoRef.current || label.trim().length === 0) {
      return;
    }

    const currentVideoTime = videoRef.current.currentTime;
    const trimmedLabel = label.trim();
    const nextTag: VideoTag = {
      id: crypto.randomUUID(),
      time: currentVideoTime,
      startTime: currentVideoTime,
      endTime: Math.min(duration || currentVideoTime + 5, currentVideoTime + 5),
      label: trimmedLabel,
      color: getTagColor(trimmedLabel),
      playerIds,
      createdAt: new Date().toISOString()
    };
    const nextTags = [...tags, nextTag];

    setSelectedTagIds([nextTag.id]);
    setExpandedTagIds([nextTag.id]);
    setEditingTagId(null);
    await saveTags(nextTags);
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

    if (newTagText.trim().length === 0) {
      return;
    }

    await createTagAtCurrentTime(newTagText, activePlayerIds);
    setNewTagText("");
    setIsAddTagOpen(false);
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
    if (!editingTag) {
      return;
    }

    const label = tagDraft.label.trim() || editingTag.label;
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
      tag.id === editingTag.id
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

  async function updateEditingTagPlayers(playerId: string) {
    if (!editingTag) {
      return;
    }

    const currentPlayerIds = editingTag.playerIds ?? [];
    const nextPlayerIds = currentPlayerIds.includes(playerId)
      ? currentPlayerIds.filter((id) => id !== playerId)
      : [...currentPlayerIds, playerId];
    const nextTags = tags.map((tag) => (tag.id === editingTag.id ? { ...tag, playerIds: nextPlayerIds } : tag));

    await saveTags(nextTags);
  }

  async function deleteTag(tagId: string) {
    if (!window.confirm("Are you sure you want to delete this tag?")) {
      return;
    }

    const nextTags = tags.filter((tag) => tag.id !== tagId);
    setSelectedTagIds((current) => current.filter((id) => id !== tagId));
    setExpandedTagIds((current) => current.filter((id) => id !== tagId));
    setEditingTagId((current) => (current === tagId ? null : current));
    await saveTags(nextTags);
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
    if (videoTeamId === teamId) {
      setVideoTeamId("");
      setActivePlayerIds([]);
      if (video) {
        nextStore.videos = {
          ...nextStore.videos,
          [video.path]: {
            ...(nextStore.videos[video.path] ?? {
              path: video.path,
              name: video.name,
              extension: video.extension,
              lastOpenedAt: new Date().toISOString(),
              tags
            }),
            matchState: undefined
          }
        };
      }
    }
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
    const nextActivePlayerIds =
      teamId === videoTeamId ? activePlayerIds.filter((activePlayerId) => activePlayerId !== playerId) : activePlayerIds;
    const nextStore = {
      ...store,
      teams: store.teams.map((team) =>
        team.id === teamId
          ? { ...team, players: team.players.filter((player) => player.id !== playerId) }
          : team
      ),
      videos:
        video && teamId === videoTeamId
          ? {
              ...store.videos,
              [video.path]: {
                ...(store.videos[video.path] ?? {
                  path: video.path,
                  name: video.name,
                  extension: video.extension,
                  lastOpenedAt: new Date().toISOString(),
                  tags
                }),
                matchState: buildMatchState(videoTeamId, nextActivePlayerIds, store)
              }
            }
          : store.videos
    };
    setActivePlayerIds(nextActivePlayerIds);
    setStore(nextStore);
    await persistStore(nextStore);
  }

  async function addQuickPlayerToVideoTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const firstName = quickPlayerDraft.firstName.trim();
    const lastName = quickPlayerDraft.lastName.trim();
    const email = quickPlayerDraft.email.trim();

    if (!videoTeam || (firstName.length === 0 && lastName.length === 0)) {
      return;
    }

    const newPlayer: Player = {
      id: crypto.randomUUID(),
      firstName,
      lastName,
      email,
      name: `${firstName} ${lastName}`.trim(),
      createdAt: new Date().toISOString()
    };
    const nextActivePlayerIds = [...activePlayerIds, newPlayer.id];
    const nextStore = {
      ...store,
      teams: store.teams.map((team) =>
        team.id === videoTeam.id ? { ...team, players: [...team.players, newPlayer] } : team
      ),
      videos: video
        ? {
            ...store.videos,
            [video.path]: {
              ...(store.videos[video.path] ?? {
                path: video.path,
                name: video.name,
                extension: video.extension,
                lastOpenedAt: new Date().toISOString(),
                tags
              }),
              matchState: {
                teamId: videoTeam.id,
                teamName: videoTeam.name,
                players: nextActivePlayerIds.map((playerId) => {
                  if (playerId === newPlayer.id) {
                    return { id: newPlayer.id, name: getPlayerDisplayName(newPlayer) };
                  }

                  const player = videoTeam.players.find((storedPlayer) => storedPlayer.id === playerId);
                  return { id: playerId, name: player ? getPlayerDisplayName(player) : "Saved player" };
                })
              }
            }
          }
        : store.videos,
      settings: {
        ...store.settings
      }
    };

    setQuickPlayerDraft({ firstName: "", lastName: "", email: "" });
    setActivePlayerIds(nextActivePlayerIds);
    setIsPlayerModalOpen(false);
    setStore(nextStore);
    await persistStore(nextStore);
  }

  function openTeamModal() {
    setMatchTeamDraftId(videoTeamId);
    setMatchPlayerDraftIds(activePlayerIds);
    setIsTeamModalOpen(true);
  }

  function cancelTeamModal() {
    setIsTeamModalOpen(false);
    setMatchTeamDraftId(videoTeamId);
    setMatchPlayerDraftIds(activePlayerIds);
  }

  function chooseMatchDraftTeam(teamId: string) {
    setMatchTeamDraftId(teamId);
    setMatchPlayerDraftIds([]);
  }

  function toggleMatchDraftPlayer(playerId: string) {
    setMatchPlayerDraftIds((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    );
  }

  async function confirmTeamModal() {
    setVideoTeamId(matchTeamDraftId);
    setActivePlayerIds(matchPlayerDraftIds);
    setIsTeamModalOpen(false);
    await persistVideoMatchState(matchTeamDraftId, matchPlayerDraftIds);
  }

  async function addStandardTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tagName = newStandardTagText.trim();

    if (tagName.length === 0 || standardTags.some((tag) => tag.toLowerCase() === tagName.toLowerCase())) {
      return;
    }

    const nextStandardTags = [...standardTags, tagName];
    setStandardTags(nextStandardTags);
    setNewStandardTagText("");
    await persistSettings({ standardTags: nextStandardTags });
  }

  async function removeStandardTag(tagName: string) {
    if (tagName === "Start" || tagName === "Goal") {
      return;
    }

    const nextStandardTags = standardTags.filter((tag) => tag !== tagName);
    setStandardTags(nextStandardTags);
    await persistSettings({ standardTags: nextStandardTags });
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

          <div className="transportDock" aria-label="Playback controls">
            <button type="button" onClick={() => seekBy(-5)} disabled={!video}>
              &lt;
            </button>
            <button type="button" onClick={isPlaying ? pauseVideo : playVideo} disabled={!video || !!videoError}>
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button type="button" onClick={speedUp} disabled={!video}>
              &gt; &gt;
            </button>
            <span>{playbackRate}x</span>
          </div>

          <section className="matchPanel" aria-label="Match team and players">
            <div className="panelTitleRow">
              <h2>Match Team</h2>
              <button type="button" onClick={openTeamModal}>
                Add Team
              </button>
            </div>

            <p>{videoTeam ? videoTeam.name : "No team selected"}</p>
            <button type="button" onClick={() => setIsPlayerModalOpen(true)} disabled={!videoTeam}>
              Add Player
            </button>

            <div className="activePlayerList">
              <h3>Players Added</h3>
              {activePlayers.length === 0 ? <p>No players selected for this video.</p> : null}
              <div className="quickTagButtons playerTagButtons">
                {activePlayers.map((player) => (
                  <button
                    className="playerTagButton"
                    type="button"
                    key={player.id}
                    disabled={!video}
                    onClick={() => createTagAtCurrentTime(getPlayerDisplayName(player), [player.id])}
                  >
                    {getPlayerDisplayName(player)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="standardTagPanel" aria-label="Standard tags">
            <div className="panelTitleRow">
              <button className="sectionTitleButton" type="button" onClick={() => setIsStandardTagsModalOpen(true)}>
                Standard Tags
              </button>
              <button type="button" onClick={openAddTagModal} disabled={!video}>
                Add Tag
              </button>
            </div>
            <div className="standardTagButtons quickTagButtons">
              {standardTags.map((tagName) => (
                <button type="button" key={tagName} disabled={!video} onClick={() => createTagAtCurrentTime(tagName)}>
                  {tagName}
                </button>
              ))}
            </div>
          </section>

          <section className="previousBlock" aria-label="Previous videos">
            <div className="panelTitleRow">
              <h2>Previous Video</h2>
              <button type="button" onClick={() => setIsPreviousVideosModalOpen(true)} disabled={previousVideos.length === 0}>
                Browse
              </button>
            </div>
            {!latestPreviousVideo ? <p>No previous videos yet.</p> : null}
            {latestPreviousVideo ? (
              <button
                className={latestPreviousVideo.missing ? "previousVideoButton missingPrevious" : "previousVideoButton"}
                type="button"
                disabled={latestPreviousVideo.missing}
                onClick={() => openPreviousVideo(latestPreviousVideo.path)}
              >
                <strong>{latestPreviousVideo.name}</strong>
                <span>{latestPreviousVideo.missing ? "File missing" : `${latestPreviousVideo.tags.length} saved tags`}</span>
                {latestPreviousVideo.tags.length > 0 ? (
                  <small>{latestPreviousVideo.tags.slice(0, 4).map((tag) => tag.label).join(", ")}</small>
                ) : null}
              </button>
            ) : null}
          </section>

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

          <p className="statusLine" role="status">
            {status}
          </p>
        </aside>

        <section className="videoPanel" aria-label="Video player">
          {video ? (
            <div className="videoStage">
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
              {activeTagNames.length > 0 ? (
                <div className="activeTagWatermark" aria-live="polite">
                  <span>Active</span>
                  <strong>{activeTagNames.join(", ")}</strong>
                </div>
              ) : null}
            </div>
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
                    <div className="tagRowActions">
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
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTagId(editingTagId === tag.id ? null : tag.id);
                          setSelectedTagIds((current) => (current.includes(tag.id) ? current : [tag.id, ...current]));
                        }}
                      >
                        {editingTagId === tag.id ? "Close" : "Edit"}
                      </button>
                      <button type="button" onClick={() => deleteTag(tag.id)}>
                        Delete
                      </button>
                    </div>
                    {expandedTagIds.includes(tag.id) || editingTagId === tag.id ? (
                      <div className="inlineTagDetails">
                        {expandedTagIds.includes(tag.id) ? (
                          <>
                            <span>{tag.label}</span>
                            <span>
                              {formatClockTime(tag.startTime ?? tag.time)} -{" "}
                              {formatClockTime(tag.endTime ?? (tag.startTime ?? tag.time) + 5)}
                            </span>
                            {tag.playerIds && tag.playerIds.length > 0 ? (
                              <span>
                                Players:{" "}
                                {activePlayers
                                  .filter((player) => tag.playerIds?.includes(player.id))
                                  .map(getPlayerDisplayName)
                                  .join(", ") || "Linked players not in the active list"}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                        {editingTagId === tag.id ? (
                          <div className="tagEditor inlineEditor">
                            <h3>Editing {tag.label}</h3>
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
                                value={tagDraft.startTime}
                                onChange={(event) =>
                                  setTagDraft((current) => ({ ...current, startTime: event.target.value }))
                                }
                              />
                            </label>
                            <label>
                              End
                              <input
                                value={tagDraft.endTime}
                                onChange={(event) =>
                                  setTagDraft((current) => ({ ...current, endTime: event.target.value }))
                                }
                              />
                            </label>
                            <div className="editPlayerList">
                              <strong>Add Players</strong>
                              {activePlayers.length === 0 ? <span>No active players selected on the left.</span> : null}
                              {activePlayers.map((player) => (
                                <label key={player.id}>
                                  <input
                                    type="checkbox"
                                    checked={(editingTag?.playerIds ?? []).includes(player.id)}
                                    onChange={() => updateEditingTagPlayers(player.id)}
                                  />
                                  {getPlayerDisplayName(player)}
                                </label>
                              ))}
                            </div>
                            <button type="button" onClick={saveSelectedTagDraft}>
                              Save Tag
                            </button>
                            {tagDraftError ? <p className="fieldError">{tagDraftError}</p> : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="emptyTags">Tags you add will appear here and reload for this video.</div>
          )}

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

        {isTeamModalOpen ? (
          <div className="modalBackdrop" role="presentation">
            <div className="tagModal wideModal" role="dialog" aria-modal="true" aria-label="Select team">
              <h2>Add Team</h2>
              <p>Select a saved team, then choose players for this match/video.</p>
              <select value={matchTeamDraftId} onChange={(event) => chooseMatchDraftTeam(event.target.value)}>
                <option value="">No team selected</option>
                {store.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <div className="playerPickList modalPickList">
                {matchDraftPlayers.map((player) => (
                  <label key={player.id}>
                    <input
                      type="checkbox"
                      checked={matchPlayerDraftIds.includes(player.id)}
                      onChange={() => toggleMatchDraftPlayer(player.id)}
                    />
                    {getPlayerDisplayName(player)}
                  </label>
                ))}
              </div>
              <div className="modalActions">
                <button type="button" onClick={cancelTeamModal}>
                  Cancel
                </button>
                <button className="primaryButton" type="button" onClick={confirmTeamModal}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isPlayerModalOpen ? (
          <div className="modalBackdrop" role="presentation">
            <form className="tagModal wideModal" onSubmit={addQuickPlayerToVideoTeam} role="dialog" aria-modal="true" aria-label="Add player">
              <h2>Add Player</h2>
              <p>Add a player to {videoTeam?.name ?? "the selected team"} and this match/video.</p>
              <input
                value={quickPlayerDraft.firstName}
                onChange={(event) => setQuickPlayerDraft((current) => ({ ...current, firstName: event.target.value }))}
                placeholder="First name"
                aria-label="First name"
              />
              <input
                value={quickPlayerDraft.lastName}
                onChange={(event) => setQuickPlayerDraft((current) => ({ ...current, lastName: event.target.value }))}
                placeholder="Last name"
                aria-label="Last name"
              />
              <input
                value={quickPlayerDraft.email}
                onChange={(event) => setQuickPlayerDraft((current) => ({ ...current, email: event.target.value }))}
                placeholder="Email optional"
                aria-label="Email"
              />
              <div className="modalActions">
                <button type="button" onClick={() => setIsPlayerModalOpen(false)}>
                  Cancel
                </button>
                <button className="primaryButton" type="submit" disabled={!videoTeam}>
                  Confirm
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {isStandardTagsModalOpen ? (
          <div className="modalBackdrop" role="presentation">
            <form className="tagModal wideModal" onSubmit={addStandardTag} role="dialog" aria-modal="true" aria-label="Standard tags">
              <h2>Standard Tags</h2>
              <p>Start and Goal are protected defaults. Custom tags are saved locally.</p>
              <div className="standardTagManager">
                {standardTags.map((tagName) => (
                  <div key={tagName}>
                    <span>{tagName}</span>
                    {tagName === "Start" || tagName === "Goal" ? (
                      <small>Default</small>
                    ) : (
                      <button type="button" onClick={() => removeStandardTag(tagName)}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="quickPlayerForm">
                <input
                  value={newStandardTagText}
                  onChange={(event) => setNewStandardTagText(event.target.value)}
                  placeholder="New standard tag"
                  aria-label="New standard tag"
                />
                <button type="submit">Add</button>
              </div>
              <div className="modalActions">
                <button type="button" onClick={() => setIsStandardTagsModalOpen(false)}>
                  Close
                </button>
                <button className="primaryButton" type="button" onClick={() => setIsStandardTagsModalOpen(false)}>
                  Done
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {isPreviousVideosModalOpen ? (
          <div className="modalBackdrop" role="presentation">
            <div className="tagModal wideModal" role="dialog" aria-modal="true" aria-label="Browse previous videos">
              <h2>Browse Previous Videos</h2>
              <div className="previousVideoList">
                {previousVideos.map((previousVideo) => (
                  <button
                    className={previousVideo.missing ? "previousVideoButton missingPrevious" : "previousVideoButton"}
                    type="button"
                    key={previousVideo.path}
                    disabled={previousVideo.missing}
                    onClick={() => {
                      setIsPreviousVideosModalOpen(false);
                      openPreviousVideo(previousVideo.path);
                    }}
                  >
                    <strong>{previousVideo.name}</strong>
                    <span>{previousVideo.missing ? "File missing" : `${previousVideo.tags.length} saved tags`}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setIsPreviousVideosModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        ) : null}

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
