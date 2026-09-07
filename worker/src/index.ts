import "dotenv/config";
import express from "express";
import { env } from "./env";
import { processVideo } from "./processVideo";
import { processClip } from "./processClip";
import { processRemoteClip } from "./processRemoteClip";
import { cleanupExpiredClips } from "./cleanupExpiredClips";
import { startLockedJob } from "./jobLock";
import { syncRbfaZipMatches } from "./syncRbfaZipMatches";

const app = express();
app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => res.json({ ok: true, clipImageIntros: 1, release: process.env.RAILWAY_GIT_COMMIT_SHA ?? null }));

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

let lastOfficialSyncDate = "";
async function runNightlyOfficialSync() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  if (![2, 3].includes(Number(parts.hour)) || lastOfficialSyncDate === date) return;
  lastOfficialSyncDate = date;
  try {
    console.log("[worker] RBFA ZIP sync complete:", await syncRbfaZipMatches());
  } catch (error) {
    console.error("[worker] RBFA ZIP sync failed:", error);
  }
}

const officialCalendarInterval = setInterval(() => { void runNightlyOfficialSync(); }, 15 * 60 * 1000);
officialCalendarInterval.unref();
void runNightlyOfficialSync();
