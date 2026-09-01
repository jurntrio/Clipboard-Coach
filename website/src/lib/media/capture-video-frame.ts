export function captureVideoFrame(video: HTMLVideoElement, notReadyMessage = "The current video frame is not ready yet."): string {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context || !canvas.width || !canvas.height) throw new Error(notReadyMessage);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
