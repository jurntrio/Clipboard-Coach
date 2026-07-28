import { randomUUID } from "node:crypto";
import { supabase } from "./supabase";

type ResourceKind = "video" | "clip";
const LOCK_TTL_MINUTES = 60;
const LOCK_REFRESH_MINUTES = 5;

// ffmpeg jobs are CPU/IO heavy; running several at once has caused ffmpeg to
// die immediately with no useful stderr. Chain them onto one queue so only
// one job's ffmpeg process runs at a time, regardless of resource kind/id.
let jobQueue: Promise<void> = Promise.resolve();

export async function startLockedJob(resourceKind: ResourceKind, resourceId: string, job: () => Promise<void>) {
  const lockToken = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MINUTES * 60_000).toISOString();

  await supabase
    .from("worker_job_locks")
    .delete()
    .eq("resource_kind", resourceKind)
    .eq("resource_id", resourceId)
    .lt("expires_at", now.toISOString());

  const { error } = await supabase.from("worker_job_locks").insert({
    resource_kind: resourceKind,
    resource_id: resourceId,
    lock_token: lockToken,
    expires_at: expiresAt
  });

  if (error?.code === "23505") return false;
  if (error) throw error;

  jobQueue = jobQueue
    .then(async () => {
      const refreshTimer = setInterval(() => {
        const refreshedExpiry = new Date(Date.now() + LOCK_TTL_MINUTES * 60_000).toISOString();
        void supabase
          .from("worker_job_locks")
          .update({ expires_at: refreshedExpiry })
          .eq("resource_kind", resourceKind)
          .eq("resource_id", resourceId)
          .eq("lock_token", lockToken)
          .then(({ error: refreshError }) => {
            if (refreshError) console.error(`[worker] failed to refresh ${resourceKind} lock ${resourceId}:`, refreshError);
          });
      }, LOCK_REFRESH_MINUTES * 60_000);
      refreshTimer.unref();
      try {
        await job();
      } finally {
        clearInterval(refreshTimer);
      }
    })
    .catch((jobError) => console.error(`[worker] ${resourceKind} job ${resourceId} failed:`, jobError))
    .finally(async () => {
      const { error: releaseError } = await supabase
        .from("worker_job_locks")
        .delete()
        .eq("resource_kind", resourceKind)
        .eq("resource_id", resourceId)
        .eq("lock_token", lockToken);
      if (releaseError) console.error(`[worker] failed to release ${resourceKind} lock ${resourceId}:`, releaseError);
    });

  return true;
}
