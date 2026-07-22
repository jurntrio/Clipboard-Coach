import "dotenv/config";
import express from "express";
import { env } from "./env";
import { processVideo } from "./processVideo";
import { processClip } from "./processClip";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/process", (req, res) => {
  const auth = req.header("authorization");
  if (auth !== `Bearer ${env.workerSharedSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { videoId, videoKey } = req.body ?? {};
  if (typeof videoId !== "string" || typeof videoKey !== "string") {
    return res.status(400).json({ error: "videoId and videoKey are required" });
  }

  // Respond immediately; processing happens in the background so the
  // website's upload flow doesn't have to wait on a slow HTTP request.
  res.status(202).json({ accepted: true });

  processVideo(videoId, videoKey).catch((error) => {
    console.error(`[worker] processing failed for video ${videoId}:`, error);
  });
});

app.post("/process-clip", (req, res) => {
  const auth = req.header("authorization");
  if (auth !== `Bearer ${env.workerSharedSecret}`) return res.status(401).json({ error: "Unauthorized" });
  const { clipId } = req.body ?? {};
  if (typeof clipId !== "string") return res.status(400).json({ error: "clipId is required" });

  res.status(202).json({ accepted: true });
  processClip(clipId).catch((error) => console.error(`[worker] processing failed for clip ${clipId}:`, error));
});

app.listen(env.port, () => {
  console.log(`[worker] listening on port ${env.port}`);
});
