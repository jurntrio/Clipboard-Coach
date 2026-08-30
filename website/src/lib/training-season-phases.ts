export const TRAINING_SEASON_PHASES = ["Pre Season", "Voorbereiding", "Competitie", "Winterstop", "After Season"] as const;
export type TrainingSeasonPhase = typeof TRAINING_SEASON_PHASES[number];
export type SeasonPhaseInput = { phase: TrainingSeasonPhase; startDate: string; endDate?: string };
export type SeasonPhaseRange = { phase: TrainingSeasonPhase; startDate: string; endDate: string };

export function canManageTrainingPhases(role: string | null | undefined, isPlatformAdmin = false) {
  return isPlatformAdmin || role === "platform_admin" || role === "club_admin";
}

const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function previousLocalDate(value: string) {
  if (!localDatePattern.test(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function calculatePhaseRanges(inputs: SeasonPhaseInput[]): { ranges: SeasonPhaseRange[]; error: string | null } {
  if (!inputs.length) return { ranges: [], error: "Voeg minstens één seizoensfase toe." };
  if (inputs.some(item => !TRAINING_SEASON_PHASES.includes(item.phase) || !localDatePattern.test(item.startDate))) {
    return { ranges: [], error: "Kies voor iedere fase een geldig fasetype en een startdatum." };
  }
  for (let index = 1; index < inputs.length; index += 1) {
    if (inputs[index].startDate <= inputs[index - 1].startDate) {
      return { ranges: [], error: inputs[index].startDate === inputs[index - 1].startDate ? "Twee fases mogen niet op dezelfde dag starten." : "Fases moeten chronologisch worden ingevoerd." };
    }
  }
  const last = inputs[inputs.length - 1];
  if (!last.endDate || !localDatePattern.test(last.endDate)) return { ranges: [], error: "Kies een einddatum voor de laatste fase." };
  if (last.endDate < last.startDate) return { ranges: [], error: "De einddatum van de laatste fase mag niet vóór de startdatum liggen." };
  const ranges = inputs.map((item, index) => ({
      phase: item.phase,
      startDate: item.startDate,
      endDate: index < inputs.length - 1 ? previousLocalDate(inputs[index + 1].startDate) : last.endDate!
    }));
  return { ranges, error: validatePhaseRanges(ranges) };
}

export function validatePhaseRanges(ranges: SeasonPhaseRange[]) {
  for (let index = 0; index < ranges.length; index += 1) {
    if (ranges[index].endDate < ranges[index].startDate) return "Een seizoensfase mag niet eindigen vóór ze start.";
    if (index > 0 && ranges[index].startDate <= ranges[index - 1].endDate) return "Seizoensfases mogen niet overlappen.";
  }
  return null;
}

export function phaseForTrainingDate(date: string, ranges: SeasonPhaseRange[]) {
  const matches = ranges.filter(range => date >= range.startDate && date <= range.endDate);
  return matches.length === 1 ? matches[0].phase : null;
}
