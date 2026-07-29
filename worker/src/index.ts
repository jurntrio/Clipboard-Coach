import "dotenv/config";
import express from "express";
import { env } from "./env";
import { processVideo } from "./processVideo";
import { processClip } from "./processClip";
import { processRemoteClip } from "./processRemoteClip";
import { cleanupExpiredClips } from "./cleanupExpiredClips";
import { startLockedJob } from "./jobLock";
import { syncFoot24Calendars } from "./syncFoot24Calendars";
import { syncVoetbalVlaanderenCalendars } from "./syncVoetbalVlaanderenCalendars";

const app = express();
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/process", async (req, res) => {
  const auth = req.header("authorization");
  if (auth !== `Bearer ${env.workerSharedSecret}`) return res.status(401).json({ error: "Unauthorized" });

  const { videoId, videoKey } = req.body ?? {};
  if (typeof videoId !== "string" || typeof videoKey !== "string") return res.status(400).json({ error: "videoId and videoKey are required" });

  try {
    const started = await startLockedJob("video", videoId, () => processVideo(videoId, videoKey));
    return res.status(202).json({ accepted: started, alreadyProcessing: !started });
  } catch (error) {
    console.error(`[worker] could not acquire video lock ${videoId}:`, error);
    return res.status(503).json({ error: "Processing lock is unavailable" });
  }
});

app.post("/process-clip", async (req, res) => {
  const auth = req.header("authorization");
  if (auth !== `Bearer ${env.workerSharedSecret}`) return res.status(401).json({ error: "Unauthorized" });
  const { clipId, mode } = req.body ?? {};
  if (typeof clipId !== "string") return res.status(400).json({ error: "clipId is required" });

  try {
    const started = await startLockedJob("clip", clipId, () => mode === "remote" ? processRemoteClip(clipId) : processClip(clipId));
    return res.status(202).json({ accepted: started, alreadyProcessing: !started });
  } catch (error) {
    console.error(`[worker] could not acquire clip lock ${clipId}:`, error);
    return res.status(503).json({ error: "Processing lock is unavailable" });
  }
});

app.listen(env.port, () => console.log(`[worker] listening on port ${env.port}`));

const cleanupInterval = setInterval(() => {
  cleanupExpiredClips()
    .then((result) => console.log("[worker] clip retention cleanup complete:", result))
    .catch((error) => console.error("[worker] clip retention cleanup failed:", error));
}, 24 * 60 * 60 * 1000);
cleanupInterval.unref();

cleanupExpiredClips()
  .then((result) => console.log("[worker] startup clip retention cleanup complete:", result))
  .catch((error) => console.error("[worker] startup clip retention cleanup failed:", error));

const calendarInterval = setInterval(() => {
  syncFoot24Calendars()
    .then((result) => console.log("[worker] Foot24 calendar sync complete:", result))
    .catch((error) => console.error("[worker] Foot24 calendar sync failed:", error));
}, 30 * 60 * 1000);
calendarInterval.unref();

syncFoot24Calendars()
  .then((result) => console.log("[worker] startup Foot24 calendar sync complete:", result))
  .catch((error) => console.error("[worker] startup Foot24 calendar sync failed:", error));

const officialCalendarInterval = setInterval(() => {
  const brusselsHour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Brussels", hour: "2-digit", hour12: false
  }).format(new Date()));
  if (brusselsHour !== 3) return;
  syncVoetbalVlaanderenCalendars()
    .then((result) => console.log("[worker] official calendar sync complete:", result))
    .catch((error) => console.error("[worker] official calendar sync failed:", error));
}, 60 * 60 * 1000);
officialCalendarInterval.unref();
