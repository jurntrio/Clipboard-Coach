export type AttendanceStatus = "present" | "injured" | "absent";
export type MembershipPeriod = { validFrom: string; validUntil: string | null };

export function normalizeAttendanceStatus(status: string, reasonLabel?: string | null): AttendanceStatus {
  if (status === "present") return "present";
  if (status === "injured" || ["gekwetst", "geblesseerd"].includes((reasonLabel ?? "").trim().toLocaleLowerCase("nl-BE"))) return "injured";
  return "absent";
}

export function isExpected(player: MembershipPeriod, date: string) {
  return player.validFrom <= date && (!player.validUntil || date <= player.validUntil);
}

export function summarize(statuses: Array<AttendanceStatus | null>) {
  const expected = statuses.filter((status): status is AttendanceStatus => status !== null);
  const present = expected.filter(status => status === "present").length;
  const injured = expected.filter(status => status === "injured").length;
  const absent = expected.filter(status => status === "absent").length;
  return { present, injured, absent, total: expected.length, percentage: expected.length ? present / expected.length * 100 : 0 };
}

export function inPeriod(date: string, period: "all" | "month" | "previous" | "custom", currentMonth: string, previousMonth: string, from = "", until = "") {
  return period === "all" || period === "month" && date.startsWith(currentMonth) || period === "previous" && date.startsWith(previousMonth) || period === "custom" && (!from || date >= from) && (!until || date <= until);
}
