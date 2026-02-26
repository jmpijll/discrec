import { X } from "lucide-react";
import { FormatSelector, type AudioFormat } from "./FormatSelector";

interface SettingsPanelProps {
  format: AudioFormat;
  onFormatChange: (format: AudioFormat) => void;
  onClose: () => void;
}

export function SettingsPanel({ format, onFormatChange, onClose }: SettingsPanelProps) {
  return (
    <div className="absolute inset-0 bg-bg-primary/95 backdrop-blur-sm z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">Settings</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Settings content */}
      <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto">
        {/* Recording format */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Recording Format
          </label>
          <FormatSelector value={format} onChange={onFormatChange} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-border">
        <p className="text-[10px] text-text-muted/40">DiscRec v1.0.0</p>
      </div>
    </div>
  );
}
