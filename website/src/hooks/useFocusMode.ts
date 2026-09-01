"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fullscreen "focus mode" for the match/video viewer: tracks fullscreen state on a
 * container element and auto-hides the chrome/side panels after a few seconds of
 * no mouse movement, revealing them again near the screen edges.
 */
export function useFocusMode() {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusChromeVisible, setFocusChromeVisible] = useState(true);
  const [focusPanel, setFocusPanel] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === viewerRef.current;
      setIsFocusMode(active);
      setFocusChromeVisible(true);
      setFocusPanel(null);
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      focusTimerRef.current = active ? setTimeout(() => setFocusChromeVisible(false), 3000) : null;
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  const revealFocusControls = useCallback((clientX: number) => {
    if (!isFocusMode) return;
    setFocusChromeVisible(true);
    const edge = Math.min(72, window.innerWidth * 0.08);
    const panelWidth = Math.min(384, window.innerWidth * 0.38);
    setFocusPanel((current) => {
      if (clientX <= edge || (current === "left" && clientX <= panelWidth)) return "left";
      if (clientX >= window.innerWidth - edge || (current === "right" && clientX >= window.innerWidth - panelWidth)) return "right";
      return null;
    });
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      setFocusChromeVisible(false);
      setFocusPanel(null);
    }, 3000);
  }, [isFocusMode]);

  const toggleFocusMode = useCallback(async () => {
    if (document.fullscreenElement === viewerRef.current) await document.exitFullscreen();
    else await viewerRef.current?.requestFullscreen();
  }, []);

  return { viewerRef, isFocusMode, focusChromeVisible, focusPanel, revealFocusControls, toggleFocusMode };
}
