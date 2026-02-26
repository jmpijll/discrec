import { cn } from "../lib/utils";

interface AudioMeterProps {
  level: number;
  isActive: boolean;
}

const BARS = 24;

export function AudioMeter({ level, isActive }: AudioMeterProps) {
  const activeBars = Math.round(level * BARS);

  return (
    <div className="flex items-end justify-center gap-[3px] h-16 px-4">
      {Array.from({ length: BARS }, (_, i) => {
        const isLit = isActive && i < activeBars;
        const intensity = i / BARS;

        return (
          <div
            key={i}
            className={cn(
              "w-[6px] rounded-full transition-all duration-75",
              isLit
                ? intensity > 0.8
                  ? "bg-record"
                  : intensity > 0.6
                    ? "bg-yellow-400"
                    : "bg-success"
                : "bg-border"
            )}
            style={{
              height: isLit
                ? `${Math.max(20, (i / BARS) * 100)}%`
                : `${Math.max(12, ((i + 1) / BARS) * 40)}%`,
            }}
          />
        );
      })}
    </div>
  );
}
