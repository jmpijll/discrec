import { X } from "lucide-react";
import { FormatSelector, type AudioFormat } from "./FormatSelector";
import { DiscordPanel } from "./DiscordPanel";

interface GuildInfo {
  id: string;
  name: string;
}

interface VoiceChannelInfo {
  id: string;
  name: string;
  guild_id: string;
}

interface SettingsPanelProps {
  format: AudioFormat;
  onFormatChange: (format: AudioFormat) => void;
  onClose: () => void;
  // Discord props
  discordConnected: boolean;
  discordConnecting: boolean;
  guilds: GuildInfo[];
  channels: VoiceChannelInfo[];
  selectedGuild: string | null;
  selectedChannel: string | null;
  onDiscordConnect: (token: string) => void;
  onDiscordDisconnect: () => void;
  onSelectGuild: (guildId: string) => void;
  onSelectChannel: (channelId: string) => void;
}

export function SettingsPanel({
  format,
  onFormatChange,
  onClose,
  discordConnected,
  discordConnecting,
  guilds,
  channels,
  selectedGuild,
  selectedChannel,
  onDiscordConnect,
  onDiscordDisconnect,
  onSelectGuild,
  onSelectChannel,
}: SettingsPanelProps) {
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
        {/* Discord Bot Integration */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Discord Bot
          </label>
          <DiscordPanel
            connected={discordConnected}
            connecting={discordConnecting}
            guilds={guilds}
            channels={channels}
            selectedGuild={selectedGuild}
            selectedChannel={selectedChannel}
            onConnect={onDiscordConnect}
            onDisconnect={onDiscordDisconnect}
            onSelectGuild={onSelectGuild}
            onSelectChannel={onSelectChannel}
          />
        </div>

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
        <p className="text-[10px] text-text-muted/40">DiscRec v1.0.1</p>
      </div>
    </div>
  );
}
