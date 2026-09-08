import assert from "node:assert/strict";
import test from "node:test";
import { canUseRecordingStartTagsAsVideoStarts, isLocalMatchVideo } from "../src/lib/match-video-source.ts";

const video = (video_key: string, video_url = "https://example.com/video.mp4") => ({ video_key, video_url });

test("local match videos can use Start Opname tags as individual video starts", () => {
  assert.equal(isLocalMatchVideo(video("local/abc", "local://abc")), true);
  assert.equal(canUseRecordingStartTagsAsVideoStarts([video("local/a", "local://a"), video("local/b", "local://b")], 2), true);
});

test("360SI recordings keep Start Opname as the match start", () => {
  assert.equal(canUseRecordingStartTagsAsVideoStarts([video("external/1391450/ch1")], 1), false);
});

test("standalone 360 links keep Start Opname as the match start", () => {
  assert.equal(canUseRecordingStartTagsAsVideoStarts([video("external-link/abc")], 1), false);
});

test("Veo links keep Start Opname as the match start", () => {
  assert.equal(canUseRecordingStartTagsAsVideoStarts([video("veo/match/standard")], 1), false);
});
