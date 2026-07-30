export type VeoRecordingSource = {
  matchSlug: string;
  sourceUrl: string;
  startOffsetSeconds: number;
};

export async function resolveVeoLink(url: string): Promise<VeoRecordingSource> {
  const response = await fetch("/api/videos/resolve-veo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url })
  });
  const body = await response.json().catch(() => null) as (VeoRecordingSource & { error?: string }) | null;
  if (!response.ok || !body) throw new Error(body?.error || "Veo-link kon niet worden geopend.");
  return body;
}
