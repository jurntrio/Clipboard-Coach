// KM Torhout's fixed 7-camera recording system. If another club's system uses a different
// path structure, this will need to become per-club configuration instead of a constant.
const EXTERNAL_RECORDING_BASE = "https://vod.usf.sport/360si/360si-dlc/recordings";

export const EXTERNAL_RECORDING_CAMERAS = [1, 2, 3, 4, 5, 6, 7] as const;

export function externalRecordingUrl(recordingId: string, cameraNumber: number) {
  return `${EXTERNAL_RECORDING_BASE}/${recordingId}/video/ch${cameraNumber}.mp4`;
}
