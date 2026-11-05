import { createHmac } from "node:crypto";

export async function getRecordingDownloadUrl(key: string) {
  const secret = process.env.RECORDING_COPY_WORKER_SECRET;
  const origin = process.env.RECORDING_COPY_WORKER_URL;
  if (!secret || !origin) throw new Error("Kopieerdienst niet geconfigureerd.");
  const expires = Math.floor(Date.now() / 1000) + 900;
  const signature = createHmac("sha256", secret).update(`recording-playback\n${key}\n${expires}`).digest("hex");
  const url = new URL("/playback", origin);
  url.search = new URLSearchParams({ key, expires: String(expires), signature }).toString();
  return url.href;
}
