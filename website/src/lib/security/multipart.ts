export const MAX_PART_URLS_PER_REQUEST = 100;
export const MAX_MULTIPART_PART_NUMBER = 10_000;
export const MAX_COMPLETE_PARTS = 10_000;

export function validPartNumbers(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PART_URLS_PER_REQUEST) return false;
  const unique = new Set<number>();
  for (const partNumber of value) {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_MULTIPART_PART_NUMBER || unique.has(partNumber)) return false;
    unique.add(partNumber);
  }
  return true;
}

export type CompletedPart = { ETag: string; PartNumber: number };

export function validCompletedParts(value: unknown): value is CompletedPart[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_COMPLETE_PARTS) return false;
  const unique = new Set<number>();
  for (const part of value) {
    if (!part || typeof part !== "object") return false;
    const candidate = part as Partial<CompletedPart>;
    if (typeof candidate.ETag !== "string" || !candidate.ETag.trim()) return false;
    if (!Number.isInteger(candidate.PartNumber) || candidate.PartNumber! < 1 || candidate.PartNumber! > MAX_MULTIPART_PART_NUMBER || unique.has(candidate.PartNumber!)) return false;
    unique.add(candidate.PartNumber!);
  }
  return true;
}