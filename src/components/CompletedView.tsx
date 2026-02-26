import { CheckCircle, FolderOpen, RotateCcw } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";

interface CompletedViewProps {
  filePath: string | null;
  duration: number;
  onReset: () => void;
}

export function CompletedView({ filePath, duration, onReset }: CompletedViewProps) {
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const fileName = filePath?.split(/[/\\]/).pop() ?? "recording.wav";

  const openFolder = async () => {
    if (!filePath) return;
    const dir = filePath.substring(0, filePath.lastIndexOf(/[/\\]/.test(filePath) ? filePath.includes("\\") ? "\\" : "/" : "/"));
    try {
      await open(dir);
    } catch {
      // Fallback: try opening the file directly
      try {
        await open(filePath);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 animate-fade-in">
      {/* Success icon */}
      <div className="relative">
        <CheckCircle className="w-20 h-20 text-success" strokeWidth={1.5} />
      </div>

      {/* Info */}
      <div className="text-center space-y-1">
        <p className="text-lg font-medium text-text-primary">Recording saved</p>
        <p className="text-sm text-text-muted font-mono truncate max-w-[320px]">
          {fileName}
        </p>
        <p className="text-xs text-text-muted">
          Duration: {formatDuration(duration)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={openFolder}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-text-muted transition-all cursor-pointer text-sm font-medium"
        >
          <FolderOpen className="w-4 h-4" />
          Open Folder
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer text-sm font-medium"
        >
          <RotateCcw className="w-4 h-4" />
          New Recording
        </button>
      </div>
    </div>
  );
}
