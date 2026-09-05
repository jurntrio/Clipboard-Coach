export type Participant = { id: string; name: string; numbers: number[] };
export type Draw = { id: string; draw_date: string; numbers: number[] };
export type Settings = { id: number; fee: number; pot_pct: number; start_date: string };
export type BingoData = { participants: Participant[]; draws: Draw[]; settings: Settings };

export const defaultSettings: Settings = { id: 1, fee: 10, pot_pct: 50, start_date: "2026-10-03" };
export const euro = (value: number) => new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(value);
export const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("nl-BE", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

export function validNumbers(value: unknown, count: number): value is number[] {
  return Array.isArray(value) && value.length === count && new Set(value).size === count
    && value.every(n => Number.isInteger(n) && n >= 1 && n <= 45);
}
export function parseNumbers(text: string, count: number): number[] {
  const parts = text.trim().split(/[\s,;]+/);
  if (parts.some(part => !/^\d{1,2}$/.test(part))) throw new Error(`Geef exact ${count} unieke gehele nummers van 1 t.e.m. 45 in.`);
  const numbers = parts.map(Number);
  if (!validNumbers(numbers, count)) throw new Error(`Geef exact ${count} unieke nummers van 1 t.e.m. 45 in.`);
  return numbers.sort((a, b) => a - b);
}
export function parseNumberSlots(values: string[], count: number): number[] {
  if (values.length !== count || values.some(value => !/^\d{1,2}$/.test(value))) {
    throw new Error(`Vul alle ${count} vakjes in met één nummer van 1 t.e.m. 45.`);
  }
  return parseNumbers(values.join(","), count);
}
export function validSaturday(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date && value.getUTCDay() === 6;
}
export function calculateGame(data: BingoData) {
  const draws = [...data.draws].filter(draw => draw.draw_date >= data.settings.start_date).sort((a, b) => a.draw_date.localeCompare(b.draw_date));
  const drawn = new Set(draws.flatMap(draw => draw.numbers));
  const ranking = data.participants.map(participant => {
    const seen = new Set<number>();
    let completedOn: string | null = null;
    for (const draw of draws) {
      draw.numbers.forEach(number => seen.add(number));
      if (participant.numbers.every(number => seen.has(number))) { completedOn = draw.draw_date; break; }
    }
    const hits = participant.numbers.filter(number => drawn.has(number));
    const missing = participant.numbers.filter(number => !drawn.has(number));
    return { ...participant, hits, missing, count: hits.length, completedOn };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "nl") || a.id.localeCompare(b.id));
  const firstCompletion = ranking.map(p => p.completedOn).filter((date): date is string => date !== null).sort()[0];
  const winners = firstCompletion ? ranking.filter(p => p.completedOn === firstCompletion) : [];
  const potCents = Math.round(data.participants.length * Number(data.settings.fee) * Number(data.settings.pot_pct));
  return { ranking, winners, drawn, draws, lastDraw: draws.at(-1), pot: potCents / 100, prize: winners.length ? potCents / 100 / winners.length : 0 };
}
