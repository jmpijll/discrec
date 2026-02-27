import { useEffect } from "react";

interface KeyboardShortcutOptions {
  onRecord: () => void;
  onStop: () => void;
  isRecording: boolean;
  canRecord: boolean;
  disabled?: boolean;
}

export function useKeyboardShortcuts({
  onRecord,
  onStop,
  isRecording,
  canRecord,
  disabled = false,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      // Ctrl+R / Cmd+R — start recording
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        if (!isRecording && canRecord) {
          onRecord();
        }
      }

      // Ctrl+S / Cmd+S — stop recording
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (isRecording) {
          onStop();
        }
      }

      // Escape — stop recording
      if (e.key === "Escape" && isRecording) {
        e.preventDefault();
        onStop();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRecord, onStop, isRecording, canRecord, disabled]);
}
