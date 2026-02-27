import { X, Bot, Music } from "lucide-react";
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
    <div className="absolute inset-0 bg-bg-primary/97 backdrop-blur-md z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <h2 className="text-[13px] font-semibold text-text-primary tracking-tight">
          Settings
        </h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted/50 hover:text-text-primary transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Settings content */}
      <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto">
        {/* Discord Bot Integration — card */}
        <div className="rounded-xl bg-bg-card border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10">
              <Bot className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-primary leading-tight">
                Discord Bot
              </p>
              <p className="text-[10px] text-text-muted/60 leading-tight mt-0.5">
                Per-speaker recording via voice channels
              </p>
            </div>
          </div>
          <div className="border-t border-border/30 pt-3">
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
        </div>

        {/* Recording format — card */}
        <div className="rounded-xl bg-bg-card border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-success/10">
              <Music className="w-3.5 h-3.5 text-success" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-primary leading-tight">
                Recording Format
              </p>
              <p className="text-[10px] text-text-muted/60 leading-tight mt-0.5">
                Choose audio encoding
              </p>
            </div>
          </div>
          <div className="border-t border-border/30 pt-3">
            <FormatSelector value={format} onChange={onFormatChange} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between">
        <p className="text-[10px] text-text-muted/30 font-medium tracking-wide">
          DiscRec v1.0.2
        </p>
        <p className="text-[10px] text-text-muted/20">
          github.com/jmpijll/discrec
        </p>
      </div>
    </div>
  );
}
