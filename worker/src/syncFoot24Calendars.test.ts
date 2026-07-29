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
