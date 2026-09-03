export const MIN_PHASE_TAG_SECONDS = 0.25;

export type PhaseTagRange = { startTime: number; endTime: number };

export function createPhaseTagRange(startTime: number, stopTime: number): PhaseTagRange | null {
  if (!Number.isFinite(startTime) || !Number.isFinite(stopTime)) return null;
  const range = {
    startTime: Math.min(startTime, stopTime),
    endTime: Math.max(startTime, stopTime)
  };
  return range.endTime - range.startTime >= MIN_PHASE_TAG_SECONDS ? range : null;
}
