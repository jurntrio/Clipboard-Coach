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

export type AvailableExternalRecordingCamera = {
  cameraNumber: number;
  url: string;
  duration: number;
};

function probeVideoMetadata(url: string, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }

    const video = document.createElement("video");
    let settled = false;
    const timeout = window.setTimeout(() => finish(null), timeoutMs);

    function finish(duration: number | null) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeAttribute("src");
      video.load();
      resolve(duration);
    }

    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      finish(duration);
    };
    video.onerror = () => finish(null);
    video.src = url;
    video.load();
  });
}

export async function availableExternalRecordingCameras(
  config: ExternalRecordingConfig,
  recordingId: string,
  timeoutMs = 8000
): Promise<AvailableExternalRecordingCamera[]> {
  const cameras = externalRecordingCameras(config);
  const results = await Promise.all(cameras.map(async (cameraNumber) => {
    const url = externalRecordingUrl(config, recordingId, cameraNumber);
    const duration = await probeVideoMetadata(url, timeoutMs);
    return duration === null ? null : { cameraNumber, url, duration };
  }));

  return results.filter((camera): camera is AvailableExternalRecordingCamera => camera !== null);
}
