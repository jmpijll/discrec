import { cn } from "../lib/utils";

export type AudioFormat = "wav" | "flac";

interface FormatSelectorProps {
  value: AudioFormat;
  onChange: (format: AudioFormat) => void;
  disabled?: boolean;
}

const formats: { value: AudioFormat; label: string; desc: string }[] = [
  { value: "wav", label: "WAV", desc: "Lossless, large" },
  { value: "flac", label: "FLAC", desc: "Lossless, compact" },
];

export function FormatSelector({ value, onChange, disabled }: FormatSelectorProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-bg-elevated border border-border">
      {formats.map((fmt) => (
        <button
          key={fmt.value}
          onClick={() => onChange(fmt.value)}
          disabled={disabled}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
            value === fmt.value
              ? "bg-accent text-white shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          )}
          title={fmt.desc}
        >
          {fmt.label}
        </button>
      ))}
    </div>
  );
}
