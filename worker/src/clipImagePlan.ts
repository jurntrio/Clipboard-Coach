export type ClipImageManifest = { excludeDrawings?: string[]; version: 1; segments: Record<string, Array<{ key: string; duration: number }>> };

export function parseImageManifest(value: unknown): ClipImageManifest {
  const plan = value as ClipImageManifest;
  if (!plan || plan.version !== 1 || !plan.segments || typeof plan.segments !== "object" || Array.isArray(plan.segments) || Object.keys(plan.segments).length > 400) throw new Error("Invalid clip image manifest");
  for (const [id, images] of Object.entries(plan.segments)) {
    if (!/^[0-9a-f-]{36}$/i.test(id) || !Array.isArray(images) || images.length > 2) throw new Error("Invalid clip image segment");
    for (const image of images) {
      if (!image || typeof image.key !== "string" || !/^clip-intros\/(creation\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}|render-assets\/[0-9a-f-]{36}\/opening)\.png$/i.test(image.key) || !Number.isFinite(image.duration) || image.duration < 0.5 || image.duration > 60) throw new Error("Invalid clip image");
    }
  }
  if (plan.excludeDrawings !== undefined && (!Array.isArray(plan.excludeDrawings) || plan.excludeDrawings.length > 400 || plan.excludeDrawings.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)))) throw new Error("Invalid drawing selection");
  return plan;
}
