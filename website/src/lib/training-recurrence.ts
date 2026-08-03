export type TrainingRecurrence = "weekly" | "biweekly" | "monthly";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function recurringDates(start: string, end: string, weekday: number, recurrence: TrainingRecurrence) {
  if (!start || !end) return [];

  const first = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || first > last) return [];

  while (first.getDay() !== weekday) first.setDate(first.getDate() + 1);
  if (first > last) return [];

  const result: string[] = [];
  if (recurrence !== "monthly") {
    const step = recurrence === "biweekly" ? 14 : 7;
    for (const cursor = new Date(first); cursor <= last; cursor.setDate(cursor.getDate() + step)) {
      result.push(isoDate(cursor));
    }
    return result;
  }

  // Keep the same weekday occurrence in each month (for example, the first Saturday).
  const occurrence = Math.floor((first.getDate() - 1) / 7) + 1;
  for (let monthOffset = 0; ; monthOffset += 1) {
    const candidate = new Date(first.getFullYear(), first.getMonth() + monthOffset, 1, 12);
    candidate.setDate(1 + ((weekday - candidate.getDay() + 7) % 7) + (occurrence - 1) * 7);
    if (candidate > last) break;
    if (candidate >= first && candidate.getMonth() === (first.getMonth() + monthOffset) % 12) result.push(isoDate(candidate));
  }
  return result;
}
