export type ExternalRecordingConfig = {
  urlTemplate: string;
  cameraCount: number;
};

export function externalRecordingConfig(row: {
  external_recording_url_template?: string | null;
  external_recording_camera_count?: number | null;
} | null | undefined): ExternalRecordingConfig | null {
  const urlTemplate = row?.external_recording_url_template ?? "";
  const cameraCount = row?.external_recording_camera_count ?? 0;
  return urlTemplate.startsWith("https://") && urlTemplate.includes("{recordingId}")
    && urlTemplate.includes("{camera}") && Number.isInteger(cameraCount) && cameraCount > 0
    ? { urlTemplate, cameraCount }
    : null;
}

export function externalRecordingCameras(config: ExternalRecordingConfig) {
  return Array.from({ length: config.cameraCount }, (_, index) => index + 1);
}

export function externalRecordingUrl(config: ExternalRecordingConfig, recordingId: string, cameraNumber: number) {
  return config.urlTemplate
    .replaceAll("{recordingId}", encodeURIComponent(recordingId))
    .replaceAll("{camera}", String(cameraNumber));
}
