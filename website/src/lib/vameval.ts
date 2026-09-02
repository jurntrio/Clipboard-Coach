export type TrainingZone = {
  zone: number;
  name: string;
  trainingForm: string;
  percentMin: number;
  percentMax: number;
  lowerKmh: number;
  upperKmh: number;
  goal: string;
};

export const VAMEVAL_MIN_DURATION_SECONDS = 120;
export const VAMEVAL_MAX_DURATION_SECONDS = 3600;

const ZONE_DEFINITIONS: { zone: number; name: string; trainingForm: string; percentMin: number; percentMax: number; goal: string }[] = [
  { zone: 1, name: "Zone 1", trainingForm: "Herstelloop / extensieve duur", percentMin: 60, percentMax: 70, goal: "Actief herstel, vetverbranding en basisconditie." },
  { zone: 2, name: "Zone 2", trainingForm: "Intensieve duurtraining", percentMin: 70, percentMax: 80, goal: "Verhogen van de aerobe drempel en marathontempo." },
  { zone: 3, name: "Zone 3", trainingForm: "Tempoloop / bloktraining", percentMin: 80, percentMax: 90, goal: "Verhogen van de anaerobe drempel, halve marathon- of 10 km-tempo." },
  { zone: 4, name: "Zone 4", trainingForm: "Lange VO2max-intervallen", percentMin: 90, percentMax: 95, goal: "Verbeteren van de zuurstofopname, met intervallen van ongeveer 2 tot 5 minuten." },
  { zone: 5, name: "Zone 5", trainingForm: "Korte VMA-intervallen", percentMin: 100, percentMax: 105, goal: "Maximale aerobe capaciteit, bijvoorbeeld 30/30-training." },
];

function round1(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** mm:ss total running time -> total seconds. */
export function toDurationSeconds(minutes: number, seconds: number): number {
  return minutes * 60 + seconds;
}

export function isValidSecondsComponent(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= 0 && seconds <= 59;
}

export function isValidVamevalDurationSeconds(durationSeconds: number): boolean {
  return Number.isFinite(durationSeconds)
    && Number.isInteger(durationSeconds)
    && durationSeconds >= VAMEVAL_MIN_DURATION_SECONDS
    && durationSeconds <= VAMEVAL_MAX_DURATION_SECONDS;
}

/**
 * Official VAMEVAL protocol: 2 min warm-up at 8 km/u, then +0.5 km/u every
 * minute from 2:00 onward. MAS (km/u) = 8 + ((T - 120) / 120), T in seconds.
 */
export function calculateVamevalMas(durationSeconds: number): number {
  if (!isValidVamevalDurationSeconds(durationSeconds)) throw new RangeError("Ongeldige VAMEVAL-looptijd.");
  return 8 + (durationSeconds - 120) / 120;
}

/** Display-rounded MAS: 2 decimals, no trailing zeros. Always compute further values from the raw (unrounded) MAS. */
export function formatMasKmh(masKmh: number): string {
  return Number(masKmh.toFixed(2)).toString();
}

export function calculateMasTrainingZones(masKmh: number): TrainingZone[] {
  if (!Number.isFinite(masKmh) || masKmh <= 0) throw new RangeError("Ongeldige MAS-waarde.");
  return ZONE_DEFINITIONS.map((zone) => ({
    zone: zone.zone,
    name: zone.name,
    trainingForm: zone.trainingForm,
    percentMin: zone.percentMin,
    percentMax: zone.percentMax,
    lowerKmh: round1((masKmh * zone.percentMin) / 100),
    upperKmh: round1((masKmh * zone.percentMax) / 100),
    goal: zone.goal,
  }));
}

export function formatTestDuration(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return "-";
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
