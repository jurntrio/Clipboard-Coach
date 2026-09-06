import assert from "node:assert/strict";
import test from "node:test";
import { emptyClipImages, makeClipImageManifest, parseClipImages } from "../src/lib/clip-images";
import { defaultClipIntro } from "../src/lib/clip-intro";
const tagA = "11111111-1111-1111-1111-111111111111";
const tagB = "22222222-2222-2222-2222-222222222222";
const image = { key: "goal.png", url: "https://example.com/goal.png", duration: 2.5 };
test("permission never makes an image mandatory", () => assert.deepEqual(parseClipImages(emptyClipImages()), { opening: null, tags: {} }));
test("opening then goal card once before the first camera; follows user tag order", () => {
  const images = { opening: { ...defaultClipIntro, enabled: true, duration: 3 }, tags: { [tagA]: image } };
  const plan = makeClipImageManifest(images, [{ id: "b", tag_id: tagB, sequence_order: 2 }, { id: "a2", tag_id: tagA, sequence_order: 1 }, { id: "a1", tag_id: tagA, sequence_order: 0 }], "opening.png");
  assert.deepEqual(plan.segments, { a1: [{ key: "opening.png", duration: 3 }, { key: "goal.png", duration: 2.5 }] });
});
test("a card can appear only before a later tag without an opening card", () => {
  assert.deepEqual(makeClipImageManifest({ opening: null, tags: { [tagB]: image } }, [{ id: "a", tag_id: tagA, sequence_order: 0 }, { id: "b", tag_id: tagB, sequence_order: 1 }]).segments, { b: [{ key: "goal.png", duration: 2.5 }] });
});
test("stale tags, missing images and invalid durations are rejected", () => {
  assert.throws(() => makeClipImageManifest({ opening: null, tags: { [tagB]: image } }, [{ id: "a", tag_id: tagA, sequence_order: 0 }]));
  for (const invalid of [{ ...image, key: "" }, { ...image, duration: 0 }, { ...image, duration: NaN }, { ...image, duration: 61 }]) assert.throws(() => parseClipImages({ opening: null, tags: { [tagA]: invalid } }));
});
