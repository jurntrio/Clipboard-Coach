import assert from "node:assert/strict";
import test from "node:test";
import { defaultClipIntro, parseClipIntro } from "../src/lib/clip-intro";

test("teams without configuration, including youth, have no intro", () => {
  assert.equal(defaultClipIntro.enabled, false);
  assert.equal(parseClipIntro(defaultClipIntro).duration, 2);
});
test("duration supports fractions and rejects invalid or excessive values", () => {
  assert.equal(parseClipIntro({ ...defaultClipIntro, duration: 2.5 }).duration, 2.5);
  for (const duration of [NaN, Infinity, 0, -1, 61, "2"]) assert.throws(() => parseClipIntro({ ...defaultClipIntro, duration }));
});
test("enabled uploads need an image and reject executable URLs", () => {
  assert.throws(() => parseClipIntro({ ...defaultClipIntro, enabled: true, mode: "upload" }));
  for (const imageUrl of ["javascript:alert(1)", "data:image/svg+xml,x", "http://example.com/a.png"]) assert.throws(() => parseClipIntro({ ...defaultClipIntro, imageUrl }));
  assert.equal(parseClipIntro({ ...defaultClipIntro, enabled: true, mode: "upload", imageUrl: "https://example.com/a.png" }).mode, "upload");
});
test("sponsors allow a custom label and either a name or logo", () => {
  assert.throws(() => parseClipIntro({ ...defaultClipIntro, enabled: true, mode: "sponsor" }));
  assert.equal(parseClipIntro({ ...defaultClipIntro, enabled: true, mode: "sponsor", sponsorName: "Test", sponsorLabel: "Schenker wedstrijdbal" }).sponsorLabel, "Schenker wedstrijdbal");
  assert.equal(parseClipIntro({ ...defaultClipIntro, enabled: true, mode: "sponsor", sponsorLogoUrl: "https://example.com/logo.png" }).sponsorName, "");
});
test("disabling an incomplete intro remains possible", () => {
  assert.equal(parseClipIntro({ ...defaultClipIntro, mode: "upload" }).enabled, false);
});
