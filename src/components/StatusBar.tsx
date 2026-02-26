import { formatDuration } from "../lib/utils";

interface StatusBarProps {
  isRecording: boolean;
  duration: number;
}

export function StatusBar({ isRecording, duration }: StatusBarProps) {
  if (!isRecording) return null;

  return (
    <div className="flex items-center gap-3 animate-fade-in">
      {/* Pulsing red dot */}
      <div className="relative">
        <div className="w-3 h-3 rounded-full bg-record" />
        <div className="absolute inset-0 w-3 h-3 rounded-full bg-record animate-ping" />
      </div>

      {/* Timer */}
      <span className="text-2xl font-mono font-semibold text-text-primary tracking-wider">
        {formatDuration(duration)}
      </span>
    </div>
  );
}
