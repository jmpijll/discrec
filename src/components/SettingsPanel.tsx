import { X, Bot, Music, Clock, Keyboard, Sun, Moon, Zap } from "lucide-react";
import { FormatSelector, type AudioFormat } from "./FormatSelector";
import { DiscordPanel } from "./DiscordPanel";
import { RecordingHistory } from "./RecordingHistory";
import { cn } from "../lib/utils";

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
  // Auto-record
  autoRecord: boolean;
  onAutoRecordChange: (enabled: boolean) => void;
  // Theme
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
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
  autoRecord,
  onAutoRecordChange,
  theme,
  onThemeChange,
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

          {/* Auto-record toggle — only when connected with a channel selected */}
          {discordConnected && selectedChannel && (
            <div className="border-t border-border/30 pt-3 animate-fade-in">
              <button
                onClick={() => onAutoRecordChange(!autoRecord)}
                className="flex items-center justify-between w-full group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Zap className={cn("w-3.5 h-3.5", autoRecord ? "text-success" : "text-text-muted/40")} />
                  <div className="text-left">
                    <p className="text-[11px] font-medium text-text-primary leading-tight">
                      Auto-record
                    </p>
                    <p className="text-[9px] text-text-muted/50 leading-tight mt-0.5">
                      Start when someone joins the channel
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    "w-8 h-[18px] rounded-full transition-colors relative",
                    autoRecord ? "bg-success" : "bg-border"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform",
                      autoRecord ? "translate-x-[16px]" : "translate-x-[2px]"
                    )}
                  />
                </div>
              </button>
            </div>
          )}
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

        {/* Recording history — card */}
        <div className="rounded-xl bg-bg-card border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-record/10">
              <Clock className="w-3.5 h-3.5 text-record" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-primary leading-tight">
                Recording History
              </p>
              <p className="text-[10px] text-text-muted/60 leading-tight mt-0.5">
                Browse past recordings
              </p>
            </div>
          </div>
          <div className="border-t border-border/30 pt-3">
            <RecordingHistory />
          </div>
        </div>

        {/* Appearance — card */}
        <div className="rounded-xl bg-bg-card border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-text-muted/10">
              {theme === "dark" ? (
                <Moon className="w-3.5 h-3.5 text-text-muted" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-text-muted" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-text-primary leading-tight">
                Appearance
              </p>
              <p className="text-[10px] text-text-muted/60 leading-tight mt-0.5">
                Theme preference
              </p>
            </div>
          </div>
          <div className="border-t border-border/30 pt-3">
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-bg-primary border border-border/50">
              <button
                onClick={() => onThemeChange("dark")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer",
                  theme === "dark"
                    ? "bg-accent text-white shadow-sm shadow-accent/20"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-elevated/50"
                )}
              >
                <Moon className="w-3 h-3" />
                Dark
              </button>
              <button
                onClick={() => onThemeChange("light")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer",
                  theme === "light"
                    ? "bg-accent text-white shadow-sm shadow-accent/20"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-elevated/50"
                )}
              >
                <Sun className="w-3 h-3" />
                Light
              </button>
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts — card */}
        <div className="rounded-xl bg-bg-card border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10">
              <Keyboard className="w-3.5 h-3.5 text-accent" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-primary leading-tight">
                Keyboard Shortcuts
              </p>
            </div>
          </div>
          <div className="border-t border-border/30 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted">Start recording</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-primary border border-border/50 text-text-muted/70">
                Ctrl+R
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted">Stop recording</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-primary border border-border/50 text-text-muted/70">
                Ctrl+S
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-muted">Stop recording</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-primary border border-border/50 text-text-muted/70">
                Esc
              </kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between">
        <p className="text-[10px] text-text-muted/30 font-medium tracking-wide">
          DiscRec v1.1.0
        </p>
        <p className="text-[10px] text-text-muted/20">
          github.com/jmpijll/discrec
        </p>
      </div>
    </div>
  );
}
