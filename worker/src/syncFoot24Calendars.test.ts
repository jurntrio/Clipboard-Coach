import assert from "node:assert/strict";
import test from "node:test";
import { parseCalendar } from "./foot24CalendarParser";

test("parses Foot24-style events and unfolded summaries", () => {
  const calendar = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:match-123",
    "DTSTART:20260912T183000Z",
    "SUMMARY:KM Torhout U13 A -",
    "  KSV Roeselare U13 A",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const events = parseCalendar(calendar);
  assert.equal(events.length, 1);
  assert.equal(events[0].uid, "match-123");
  assert.equal(events[0].summary, "KM Torhout U13 A - KSV Roeselare U13 A");
  assert.equal(events[0].cancelled, false);
});

test("recognizes cancelled matches", () => {
  const calendar = [
    "BEGIN:VEVENT",
    "UID:cancelled-1",
    "DTSTART;VALUE=DATE:20261003",
    "SUMMARY:Thuis - Uit",
    "STATUS:CANCELLED",
    "END:VEVENT"
  ].join("\n");

  const [event] = parseCalendar(calendar);
  assert.equal(event.cancelled, true);
});

test("parses the timezone and summary format used by the KM Torhout A feed", () => {
  const calendar = [
    "BEGIN:VEVENT",
    "UID:6a69f7d2bf208",
    "DTSTART;TZID=Europe/Brussels:20260729T200000",
    "DTEND;TZID=Europe/Brussels:20260729T214500",
    "SUMMARY:⚽ KM TORHOUT - KVV. ZELZATE (1 A)",
    "END:VEVENT"
  ].join("\r\n");

  const [event] = parseCalendar(calendar);
  assert.equal(event.uid, "6a69f7d2bf208");
  assert.equal(event.summary, "⚽ KM TORHOUT - KVV. ZELZATE (1 A)");
  assert.equal(event.startsAt.toISOString(), "2026-07-29T18:00:00.000Z");
});
