import { useEffect } from "react";

/**
 * Points a <video> element at `src`, transparently loading it through hls.js
 * when it's an HLS playlist (.m3u8) and the browser has no native HLS
 * support (Safari does; Chrome/Firefox/Edge don't).
 */
export function useHlsSource(videoRef: React.RefObject<HTMLVideoElement | null>, src: string | null | undefined) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const isHls = src.includes(".m3u8");
    const supportsNativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";

    if (!isHls || supportsNativeHls) {
      video.src = src;
      return;
    }

    let hlsInstance: import("hls.js").default | undefined;
    let cancelled = false;

    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        video.src = src;
        return;
      }
      hlsInstance = new Hls();
      hlsInstance.loadSource(src);
      hlsInstance.attachMedia(video);
    });

    return () => {
      cancelled = true;
      hlsInstance?.destroy();
    };
  }, [videoRef, src]);
}
