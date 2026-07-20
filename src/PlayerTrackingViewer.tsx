import { useEffect, useMemo, useRef, useState } from "react";
import navHomeUrl from "../assets/branding/home.png";
import navBackUrl from "../assets/branding/back.png";
import trackingLogoUrl from "../assets/branding/tracking.png";
import type {
  AppStore,
  ManualTrackSeed,
  Player,
  PlayerTrackingProgress,
  PlayerTrackingRun,
  PlayerTrackRecord,
  PlayerTrackSample,
  StoredVideo,
  VideoFile
} from "../shared/types";
import { buildCalibrationHomography, calculateTrackDistanceMeters, formatDistance } from "./trackingStats";

const DEFAULT_RANGE_DURATION_SECONDS = 20;
const MARKER_RADIUS = 7;
const LABEL_OFFSET_X = 10;
const LABEL_OFFSET_Y = -14;

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function displayPlayerName(player: Player) {
  return player.name || [player.firstName, player.lastName].filter(Boolean).join(" ") || player.id;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasValidBlockRange(video: StoredVideo | undefined) {
  return (
    isFiniteNumber(video?.kickoffVideoOffset) &&
    isFiniteNumber(video?.blockEndVideoOffset) &&
    video.blockEndVideoOffset > video.kickoffVideoOffset
  );
}

function getFallbackRange(video: StoredVideo | undefined) {
  const start = isFiniteNumber(video?.kickoffVideoOffset) ? video.kickoffVideoOffset : 0;
  const end = start + DEFAULT_RANGE_DURATION_SECONDS;
  return { start, end };
}

function getTrackMarkerPoint(sample: PlayerTrackSample) {
  return {
    x: sample.box.x + sample.box.width / 2,
    y: sample.box.y + sample.box.height / 2
  };
}

function findSampleAtTime(track: PlayerTrackRecord, timeSeconds: number, sampleFps: number) {
  if (track.samples.length === 0) return null;

  const first = track.samples[0];
  const last = track.samples[track.samples.length - 1];
  if (timeSeconds < first.timeSeconds || timeSeconds > last.timeSeconds) return null;

  for (let index = 1; index < track.samples.length; index++) {
    const previous = track.samples[index - 1];
    const next = track.samples[index];
    if (timeSeconds > next.timeSeconds) continue;

    const gap = next.timeSeconds - previous.timeSeconds;
    const maxGap = Math.max(2, 4 / Math.max(1, sampleFps));
    if (gap <= 0) return previous;
    if (gap > maxGap) {
      return Math.abs(previous.timeSeconds - timeSeconds) <= Math.abs(next.timeSeconds - timeSeconds) ? previous : next;
    }

    const t = (timeSeconds - previous.timeSeconds) / gap;
    return {
      ...previous,
      timeSeconds,
      box: {
        x: previous.box.x + (next.box.x - previous.box.x) * t,
        y: previous.box.y + (next.box.y - previous.box.y) * t,
        width: previous.box.width + (next.box.width - previous.box.width) * t,
        height: previous.box.height + (next.box.height - previous.box.height) * t
      },
      confidence: previous.confidence + (next.confidence - previous.confidence) * t
    };
  }

  return last;
}

function hasEnoughSamplesToFollow(track: PlayerTrackRecord) {
  return track.samples.length > 1;
}

function getVideoContentRect(videoEl: HTMLVideoElement) {
  const rect = videoEl.getBoundingClientRect();
  const videoWidth = videoEl.videoWidth;
  const videoHeight = videoEl.videoHeight;

  if (!videoWidth || !videoHeight || !rect.width || !rect.height) {
    return rect;
  }

  const videoAspect = videoWidth / videoHeight;
  const elementAspect = rect.width / rect.height;

  if (elementAspect > videoAspect) {
    const width = rect.height * videoAspect;
    const left = rect.left + (rect.width - width) / 2;
    return new DOMRect(left, rect.top, width, rect.height);
  }

  const height = rect.width / videoAspect;
  const top = rect.top + (rect.height - height) / 2;
  return new DOMRect(rect.left, top, rect.width, height);
}

type Props = {
  store: AppStore;
  videoId: string;
  onSaveStore: (store: AppStore) => Promise<void>;
  onBack: () => void;
};

export default function PlayerTrackingViewer({ store, videoId, onSaveStore, onBack }: Props) {
  const storedVideo = store.videos[videoId];
  const hasBlockTimeRange = hasValidBlockRange(storedVideo);
  const fallbackRange = getFallbackRange(storedVideo);

  const [loadedVideo, setLoadedVideo] = useState<VideoFile | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);

  const [trackingRun, setTrackingRun] = useState<PlayerTrackingRun | null>(storedVideo?.tracking ?? null);
  const [visibleTrackIds, setVisibleTrackIds] = useState<number[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [rangeStart, setRangeStart] = useState(fallbackRange.start);
  const [rangeEnd, setRangeEnd] = useState(fallbackRange.end);
  const [seeds, setSeeds] = useState<ManualTrackSeed[]>([]);
  const [armedSeed, setArmedSeed] = useState<{ playerId?: string; playerName: string } | null>(null);
  const [isAddTagModalOpen, setIsAddTagModalOpen] = useState(false);
  const [addTagTeamId, setAddTagTeamId] = useState("");
  const [addTagFreeName, setAddTagFreeName] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [trackingProgress, setTrackingProgress] = useState<PlayerTrackingProgress | null>(null);
  const [trackingError, setTrackingError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeRangeStart = hasBlockTimeRange ? storedVideo!.kickoffVideoOffset! : rangeStart;
  const activeRangeEnd = hasBlockTimeRange ? storedVideo!.blockEndVideoOffset! : rangeEnd;
  const calibrationHomography = useMemo(() => buildCalibrationHomography(storedVideo), [storedVideo?.calibration]);
  const trackSummaries = useMemo(
    () =>
      (trackingRun?.tracks ?? []).map((track) => ({
        track,
        distanceMeters: calculateTrackDistanceMeters(track, calibrationHomography, videoSize)
      })),
    [trackingRun, calibrationHomography, videoSize]
  );
  const selectedTrackSummary = trackSummaries.find((summary) => summary.track.trackId === selectedTrackId) ?? null;

  useEffect(() => {
    let cancelled = false;
    const initialRange = hasValidBlockRange(storedVideo)
      ? { start: storedVideo!.kickoffVideoOffset!, end: storedVideo!.blockEndVideoOffset! }
      : getFallbackRange(storedVideo);
    setLoadedVideo(null);
    setLoadError("");
    setIsPlaying(false);
    setCurrentTime(initialRange.start);
    setDuration(0);
    setVideoSize(null);
    setRangeStart(initialRange.start);
    setRangeEnd(initialRange.end);
    setTrackingRun(storedVideo?.tracking ?? null);
    setVisibleTrackIds(storedVideo?.tracking?.tracks.map((track) => track.trackId) ?? []);
    setSelectedTrackId(null);
    setTrackingError("");
    setSeeds([]);
    setArmedSeed(null);
    setIsAddTagModalOpen(false);

    if (!storedVideo) {
      setLoadError("Video niet gevonden.");
      return;
    }

    window.clipboardCoach
      .openVideoFromPath(storedVideo.path)
      .then((videoFile) => {
        if (!cancelled) setLoadedVideo(videoFile);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Video laden mislukt.");
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, storedVideo?.path, storedVideo?.kickoffVideoOffset, storedVideo?.blockEndVideoOffset]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, loadedVideo]);

  useEffect(() => {
    return window.clipboardCoach.onPlayerTrackingProgress((progress) => {
      if (progress.videoKey === videoId) setTrackingProgress(progress);
    });
  }, [videoId]);

  // Draws markers in native video pixel space, then sizes the canvas to the
  // actual object-fit: contain content rect so labels do not drift into the
  // letterboxed area.
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    const videoEl = videoRef.current;
    if (!canvas || !videoEl || !videoEl.videoWidth) return;

    function positionCanvas() {
      const canvas = overlayCanvasRef.current;
      const videoEl = videoRef.current;
      if (!canvas || !videoEl || !videoEl.videoWidth) return;

      const contentRect = getVideoContentRect(videoEl);
      const elementRect = videoEl.getBoundingClientRect();
      canvas.style.left = `${contentRect.left - elementRect.left}px`;
      canvas.style.top = `${contentRect.top - elementRect.top}px`;
      canvas.style.width = `${contentRect.width}px`;
      canvas.style.height = `${contentRect.height}px`;
      canvas.style.right = "auto";
      canvas.style.bottom = "auto";
    }

    positionCanvas();
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    function drawMarker(point: { x: number; y: number }, label: string, color: string) {
      if (!ctx) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, MARKER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "22px sans-serif";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = color;
      ctx.fillText(label, point.x + LABEL_OFFSET_X, point.y + LABEL_OFFSET_Y);
    }

    if (!trackingRun) {
      seeds.forEach((seed) => drawMarker(seed.point, seed.playerName, "#3aa7ff"));
    }

    if (trackingRun) {
      for (const track of trackingRun.tracks) {
        if (!visibleTrackIds.includes(track.trackId)) continue;
        const sample = findSampleAtTime(track, currentTime, trackingRun.sampleFps);
        if (!sample) continue;
        drawMarker(getTrackMarkerPoint(sample), track.playerName, "#3aa7ff");
      }
    }

    const resizeObserver = new ResizeObserver(positionCanvas);
    resizeObserver.observe(videoEl);
    window.addEventListener("resize", positionCanvas);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", positionCanvas);
    };
  }, [seeds, trackingRun, visibleTrackIds, currentTime, loadedVideo, duration]);

  function seekTo(time: number) {
    const player = videoRef.current;
    if (!player) return;
    player.currentTime = time;
    setCurrentTime(time);
  }

  function handleVideoClick(event: React.MouseEvent<HTMLVideoElement>) {
    if (isTracking || !armedSeed) return;
    const videoEl = videoRef.current;
    if (!videoEl || !videoEl.videoWidth) return;

    const rect = getVideoContentRect(videoEl);
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      return;
    }

    const x = ((event.clientX - rect.left) / rect.width) * videoEl.videoWidth;
    const y = ((event.clientY - rect.top) / rect.height) * videoEl.videoHeight;

    // Existing tracked players (from a previous run, possibly reloaded from
    // storage so they're no longer in `seeds`) still occupy their trackId -
    // include them in the max so a newly added seed can never collide.
    const existingTrackIds = [
      ...seeds.map((seed) => seed.trackId),
      ...(trackingRun?.tracks.map((track) => track.trackId) ?? [])
    ];
    const nextTrackId = existingTrackIds.reduce((max, id) => Math.max(max, id), 0) + 1;
    setSeeds((current) => [
      ...current,
      { trackId: nextTrackId, playerId: armedSeed.playerId, playerName: armedSeed.playerName, point: { x, y } }
    ]);
    setArmedSeed(null);
  }

  function removeSeed(trackId: number) {
    setSeeds((current) => current.filter((seed) => seed.trackId !== trackId));
  }

  function openAddTagModal() {
    setAddTagTeamId("");
    setAddTagFreeName("");
    setIsAddTagModalOpen(true);
  }

  function armSeed(playerId: string | undefined, playerName: string) {
    if (!playerName.trim()) return;
    // Seed points are always resolved against the first frame of the tracking
    // range on the backend (see runTracking.ts), so the click has to land on
    // that exact frame. Snap playback back to the range start here, otherwise
    // a user who scrubbed ahead before tagging places the point on the wrong
    // frame and the resulting track never matches that player.
    const player = videoRef.current;
    if (player) {
      player.pause();
      player.currentTime = activeRangeStart;
    }
    setCurrentTime(activeRangeStart);
    setArmedSeed({ playerId, playerName: playerName.trim() });
    setIsAddTagModalOpen(false);
  }

  async function startTracking() {
    if (!storedVideo || isTracking || seeds.length === 0) return;
    setIsTracking(true);
    setTrackingError("");
    setTrackingProgress(null);

    try {
      const result = await window.clipboardCoach.runPlayerTracking(videoId, {
        startSeconds: activeRangeStart,
        endSeconds: activeRangeEnd,
        seeds
      });
      // Adding a player to an already-tracked block only submits the new
      // seed(s) - keep any previously tracked players whose trackId isn't
      // part of this run's result, rather than discarding them. (If a seed
      // reused an existing trackId - re-tagging in the same session without
      // reloading - the fresh result for that id naturally replaces the old one.)
      const previousTracks = trackingRun?.tracks ?? [];
      const resultTrackIds = new Set(result.tracks.map((track) => track.trackId));
      const merged = { ...result, tracks: [...previousTracks.filter((t) => !resultTrackIds.has(t.trackId)), ...result.tracks] };

      setTrackingRun(merged);
      setVisibleTrackIds(merged.tracks.map((track) => track.trackId));
      await onSaveStore({
        ...store,
        videos: { ...store.videos, [videoId]: { ...storedVideo, tracking: merged } }
      });
    } catch (error) {
      setTrackingError(error instanceof Error ? error.message : "Tracking mislukt.");
    } finally {
      setIsTracking(false);
      setTrackingProgress(null);
    }
  }

  function togglePlay() {
    const player = videoRef.current;
    if (!player) return;
    if (player.paused) player.play();
    else player.pause();
  }

  function seekBy(offsetSeconds: number) {
    const player = videoRef.current;
    if (!player) return;
    player.currentTime = Math.max(0, Math.min(duration || player.currentTime, player.currentTime + offsetSeconds));
  }

  function cycleSpeed() {
    setPlaybackRate((rate) => (rate >= 2 ? 1 : rate + 0.25));
  }

  function toggleVisibleTrack(trackId: number) {
    setVisibleTrackIds((current) =>
      current.includes(trackId) ? current.filter((id) => id !== trackId) : [...current, trackId]
    );
  }

  function resetTracking() {
    setTrackingRun(null);
    setSeeds([]);
    setVisibleTrackIds([]);
    setSelectedTrackId(null);
  }

  return (
    <main className="sectionShell trackingEditorShell">
      <header className="sectionHeader">
        <div className="playerDetailHeaderNav">
          <button type="button" className="playerNavBtn" onClick={onBack} title="Terug">
            <img src={navBackUrl} alt="Terug" />
          </button>
          <button type="button" className="playerNavBtn" onClick={onBack} title="Home">
            <img src={navHomeUrl} alt="Home" />
          </button>
        </div>
        <div>
          <h1>Tracking — {storedVideo?.matchBlockLabel ?? storedVideo?.name ?? ""}</h1>
          <p>{storedVideo?.name}</p>
        </div>
        <img className="sectionHeaderArtwork" src={trackingLogoUrl} alt="" />
      </header>

      {loadError ? (
        <p className="trackingErrorMsg">{loadError}</p>
      ) : (
        <div className="trackingCalibEditor">
          <div className="trackingCanvasWrap trackingViewerStage">
            {loadedVideo ? (
              <>
                <video
                  ref={videoRef}
                  src={loadedVideo.url}
                  className="trackingVideo"
                  crossOrigin="anonymous"
                  onLoadedMetadata={() => {
                    const player = videoRef.current;
                    if (!player) return;
                    setDuration(player.duration);
                    setVideoSize({ width: player.videoWidth, height: player.videoHeight });
                    player.currentTime = activeRangeStart;
                    setCurrentTime(activeRangeStart);
                  }}
                  onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onClick={handleVideoClick}
                />
                <canvas ref={overlayCanvasRef} className="trackingViewerOverlayCanvas" />
              </>
            ) : (
              <p className="trackingEmptyHint">Video laden...</p>
            )}
          </div>
          <aside className="trackingViewerSidePanel">
            <h3>Add Tag</h3>

            {!isTracking && !trackingRun && (
              <div className="trackingAddRefForm">
                {hasBlockTimeRange ? (
                  <p className="trackingEmptyHint">
                    Blokrange: {fmt(activeRangeStart)} → {fmt(activeRangeEnd)}
                  </p>
                ) : (
                  <>
                    <label>
                      Start (seconden)
                      <div className="trackingRangeStartRow">
                        <input
                          type="number"
                          min={0}
                          value={rangeStart}
                          onChange={(event) => setRangeStart(Math.max(0, Number(event.target.value)))}
                        />
                        <button type="button" onClick={() => setRangeStart(Math.floor(currentTime))}>
                          Huidige positie
                        </button>
                        {storedVideo?.kickoffVideoOffset != null && (
                          <button type="button" onClick={() => setRangeStart(storedVideo.kickoffVideoOffset ?? 0)}>
                            Blok start ({fmt(storedVideo.kickoffVideoOffset)})
                          </button>
                        )}
                      </div>
                    </label>
                    <label>
                      Einde (seconden)
                      <div className="trackingRangeStartRow">
                        <input
                          type="number"
                          min={rangeStart + 1}
                          value={rangeEnd}
                          onChange={(event) => setRangeEnd(Math.max(rangeStart + 1, Number(event.target.value)))}
                        />
                        {storedVideo?.blockEndVideoOffset != null && (
                          <button type="button" onClick={() => setRangeEnd(storedVideo.blockEndVideoOffset ?? rangeEnd)}>
                            Blok einde ({fmt(storedVideo.blockEndVideoOffset)})
                          </button>
                        )}
                      </div>
                    </label>
                  </>
                )}
                <p className="trackingEmptyHint">
                  Voeg een tag toe en klik daarna op die speler in de video. Het programma volgt
                  ze binnen de geselecteerde blokrange.
                </p>

                <button type="button" onClick={openAddTagModal}>
                  Add Tag
                </button>

                {armedSeed && (
                  <p className="trackingArmedHint">
                    Klik op de video om <strong>{armedSeed.playerName}</strong> te plaatsen.{" "}
                    <button type="button" onClick={() => setArmedSeed(null)}>
                      Annuleren
                    </button>
                  </p>
                )}

                {seeds.length > 0 && (
                  <>
                    <h4>Aangewezen spelers</h4>
                    <ul className="trackingSeedList">
                      {seeds.map((seed) => (
                        <li key={seed.trackId}>
                          <span>{seed.playerName}</span>
                          <button type="button" onClick={() => removeSeed(seed.trackId)} title="Verwijderen">
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <button
                  type="button"
                  className="primaryButton"
                  disabled={!loadedVideo || seeds.length === 0}
                  onClick={startTracking}
                >
                  Start tracking
                </button>
              </div>
            )}

            {isTracking && (
              <div className="trackingAddRefForm">
                <p>
                  {trackingProgress?.stage === "extracting"
                    ? "Frames extraheren..."
                    : trackingProgress?.stage === "detecting"
                      ? "Spelers volgen..."
                      : "Bezig..."}
                </p>
                <progress value={trackingProgress?.progress ?? 0} max={1} style={{ width: "100%" }} />
              </div>
            )}

            {trackingError && <p className="trackingErrorMsg">{trackingError}</p>}

            {!isTracking && trackingRun && (
              <div className="trackingAddRefForm">
                <h4>Getagde spelers</h4>
                <ul className="trackingSeedList">
                  {trackSummaries.map(({ track }) => (
                    <li key={track.trackId} className="trackingPlayerListItem">
                      <label className="trackingTrackToggle" title="Toon tag voortdurend">
                        <input
                          type="checkbox"
                          checked={visibleTrackIds.includes(track.trackId)}
                          onChange={() => toggleVisibleTrack(track.trackId)}
                        />
                      </label>
                      <button
                        type="button"
                        className="trackingTrackNameButton"
                        onClick={() => setSelectedTrackId(track.trackId)}
                      >
                        {track.playerName}
                        {!hasEnoughSamplesToFollow(track) && <span>Niet gevolgd</span>}
                      </button>
                    </li>
                  ))}
                </ul>

                <button type="button" onClick={openAddTagModal}>
                  Add Tag
                </button>

                {armedSeed && (
                  <p className="trackingArmedHint">
                    Klik op de video om <strong>{armedSeed.playerName}</strong> te plaatsen.{" "}
                    <button type="button" onClick={() => setArmedSeed(null)}>
                      Annuleren
                    </button>
                  </p>
                )}

                {(() => {
                  const pendingSeeds = seeds.filter(
                    (seed) => !trackingRun.tracks.some((track) => track.trackId === seed.trackId)
                  );
                  if (pendingSeeds.length === 0) return null;
                  return (
                    <>
                      <h4>Nog te trackenen</h4>
                      <ul className="trackingSeedList">
                        {pendingSeeds.map((seed) => (
                          <li key={seed.trackId}>
                            <span>{seed.playerName}</span>
                            <button type="button" onClick={() => removeSeed(seed.trackId)} title="Verwijderen">
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button type="button" className="primaryButton" onClick={startTracking}>
                        Extra speler(s) trackenen
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </aside>
        </div>
      )}

      {loadedVideo && (
        <div className="trackingVideoControls">
          <button type="button" onClick={() => seekBy(-5)}>
            «5s
          </button>
          <button type="button" onClick={togglePlay}>
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button type="button" onClick={() => seekBy(5)}>
            5s»
          </button>
          <div className="trackingSeekBarWrap">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={(event) => {
                const t = Number(event.target.value);
                if (videoRef.current) videoRef.current.currentTime = t;
                setCurrentTime(t);
              }}
            />
            {duration > 0 && storedVideo?.kickoffVideoOffset != null && (
              <button
                type="button"
                className="trackingTimelineFlag"
                style={{ left: `${(storedVideo.kickoffVideoOffset / duration) * 100}%` }}
                onDoubleClick={() => seekTo(storedVideo.kickoffVideoOffset ?? 0)}
                title="Blok start — dubbelklik om te springen"
              >
                🚩
              </button>
            )}
            {duration > 0 && storedVideo?.blockEndVideoOffset != null && (
              <button
                type="button"
                className="trackingTimelineFlag"
                style={{ left: `${(storedVideo.blockEndVideoOffset / duration) * 100}%` }}
                onDoubleClick={() => seekTo(storedVideo.blockEndVideoOffset ?? duration)}
                title="Blok einde — dubbelklik om te springen"
              >
                🏁
              </button>
            )}
          </div>
          <span className="trackingTimecode">
            {fmt(currentTime)} / {fmt(duration)}
          </span>
          <button type="button" onClick={cycleSpeed}>
            {playbackRate}x
          </button>
        </div>
      )}

      {selectedTrackSummary && trackingRun && (
        <div className="modalBackdrop" role="presentation">
          <div className="tagModal trackingPlayerDetailModal" role="dialog" aria-modal="true" aria-label="Spelerdetails">
            <h2>{selectedTrackSummary.track.playerName}</h2>
            <div className="trackingPlayerDetailGrid">
              <span>Afgelegde afstand</span>
              <strong>{formatDistance(selectedTrackSummary.distanceMeters)}</strong>
              <span>Tracking range</span>
              <strong>
                {fmt(trackingRun.startSeconds)} → {fmt(trackingRun.endSeconds)}
              </strong>
              <span>Samples</span>
              <strong>{selectedTrackSummary.track.samples.length}</strong>
              <span>Sample rate</span>
              <strong>{trackingRun.sampleFps} fps</strong>
            </div>
            {!hasEnoughSamplesToFollow(selectedTrackSummary.track) && (
              <p className="trackingWarnMsg">
                Tracking is niet gelukt voor deze speler. Er is alleen een startpunt opgeslagen, dus de tag kan nog niet
                meebewegen en afstand blijft 0 m. Tag deze speler opnieuw en start tracking opnieuw.
              </p>
            )}
            {selectedTrackSummary.distanceMeters === null && (
              <p className="trackingEmptyHint">
                Afstand kan pas berekend worden zodra kalibratie en videomaat beschikbaar zijn.
              </p>
            )}
            <label className="trackingDetailToggle">
              <input
                type="checkbox"
                checked={visibleTrackIds.includes(selectedTrackSummary.track.trackId)}
                onChange={() => toggleVisibleTrack(selectedTrackSummary.track.trackId)}
              />
              Toon tag voortdurend
            </label>
            <div className="modalActions">
              <button type="button" onClick={() => setSelectedTrackId(null)}>
                Sluiten
              </button>
              <button type="button" onClick={resetTracking}>
                Opnieuw taggen
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddTagModalOpen && (
        <div className="modalBackdrop" role="presentation">
          <div className="tagModal" role="dialog" aria-modal="true" aria-label="Add Tag">
            <h2>Add Tag</h2>

            <label>
              Ploeg
              <select value={addTagTeamId} onChange={(event) => setAddTagTeamId(event.target.value)}>
                <option value="">— kies ploeg —</option>
                {store.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>

            {addTagTeamId && (
              <label>
                Speler
                <select value="" onChange={(event) => {
                  const player = store.teams.find((team) => team.id === addTagTeamId)?.players.find(
                    (p) => p.id === event.target.value
                  );
                  if (player) armSeed(player.id, displayPlayerName(player));
                }}>
                  <option value="">— kies speler —</option>
                  {(store.teams.find((team) => team.id === addTagTeamId)?.players ?? []).map((player) => (
                    <option key={player.id} value={player.id}>
                      {displayPlayerName(player)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <p className="trackingEmptyHint">Of iemand toevoegen die niet in de lijst staat:</p>
            <div className="trackingRangeStartRow">
              <input
                type="text"
                placeholder="Naam"
                value={addTagFreeName}
                onChange={(event) => setAddTagFreeName(event.target.value)}
              />
              <button type="button" onClick={() => armSeed(undefined, addTagFreeName)}>
                Toevoegen
              </button>
            </div>

            <div className="modalActions">
              <button type="button" onClick={() => setIsAddTagModalOpen(false)}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
