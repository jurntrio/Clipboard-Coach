import { parseClipIntro, type ClipIntro } from "./clip-intro";

export type ClipImage = { key: string; url: string; duration: number };
export type ClipImages = { opening: ClipIntro | null; tags: Record<string, ClipImage> };
export type ClipImageManifest = { excludeDrawings?: string[]; version: 1; segments: Record<string, Array<{ key: string; duration: number }>> };
export const emptyClipImages = (): ClipImages => ({ opening: null, tags: {} });

export function parseClipImages(value: unknown): ClipImages {
  if (!value || typeof value !== "object") throw new Error("Ongeldige clipbeelden.");
  const input = value as Record<string, unknown>;
  const opening = input.opening == null ? null : parseClipIntro(input.opening);
  if (!input.tags || typeof input.tags !== "object" || Array.isArray(input.tags) || Object.keys(input.tags).length > 200) throw new Error("Ongeldige fragmentbeelden.");
  const tags: Record<string, ClipImage> = {};
  for (const [id, value] of Object.entries(input.tags)) {
    const image = value as ClipImage;
    if (!/^[0-9a-f-]{36}$/i.test(id) || !image || typeof image.key !== "string" || !image.key || typeof image.url !== "string" || !image.url || !Number.isFinite(image.duration) || image.duration < 0.5 || image.duration > 60) throw new Error("Kies een afbeelding en een duur tussen 0,5 en 60 seconden per fragment.");
    tags[id] = { key: image.key, url: image.url, duration: image.duration };
  }
  return { opening: opening?.enabled ? opening : null, tags };
}

export function parseExcludedDrawingTagIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 200 || value.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) throw new Error("Ongeldige keuze voor tekeningen.");
  return [...new Set(value as string[])];
}

export function makeClipImageManifest(images: ClipImages, segments: Array<{ id: string; tag_id: string; sequence_order: number }>, openingKey?: string, excludedDrawingTagIds: string[] = []): ClipImageManifest {
  const ordered = [...segments].sort((a, b) => a.sequence_order - b.sequence_order);
  const selected = new Set(ordered.map(item => item.tag_id));
  if (Object.keys(images.tags).some(id => !selected.has(id))) throw new Error("Een fragmentbeeld hoort niet bij deze clip.");
  if (images.opening && !openingKey) throw new Error("Het openingsbeeld ontbreekt.");
  if (excludedDrawingTagIds.some(id => !selected.has(id))) throw new Error("Een tekeningkeuze hoort niet bij deze clip.");
  const result: ClipImageManifest = { version: 1, segments: {} };
  if (excludedDrawingTagIds.length) result.excludeDrawings = ordered.filter(segment => excludedDrawingTagIds.includes(segment.tag_id)).map(segment => segment.id);
  const seen = new Set<string>();
  for (const [index, segment] of ordered.entries()) {
    const before: Array<{ key: string; duration: number }> = [];
    if (index === 0 && images.opening && openingKey) before.push({ key: openingKey, duration: images.opening.duration });
    const tagImage = images.tags[segment.tag_id];
    if (!seen.has(segment.tag_id) && tagImage) before.push({ key: tagImage.key, duration: tagImage.duration });
    seen.add(segment.tag_id);
    if (before.length) result.segments[segment.id] = before;
  }
  return result;
}
