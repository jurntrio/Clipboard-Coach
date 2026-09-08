import type { Video } from "@/types/database";

export function isLocalMatchVideo(video: Pick<Video, "video_key" | "video_url">) {
  return video.video_key.startsWith("local/") || video.video_url.startsWith("local://");
}

export function canUseRecordingStartTagsAsVideoStarts(videos: Array<Pick<Video, "video_key" | "video_url">>, recordingStartCount: number) {
  return videos.length > 0 && videos.every(isLocalMatchVideo) && recordingStartCount === videos.length;
}
