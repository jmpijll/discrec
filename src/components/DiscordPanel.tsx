import { useState } from "react";
import { Plug, Unplug, Loader2, ChevronDown, CheckCircle2 } from "lucide-react";
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

interface DiscordPanelProps {
  connected: boolean;
  connecting: boolean;
  guilds: GuildInfo[];
  channels: VoiceChannelInfo[];
  selectedGuild: string | null;
  selectedChannel: string | null;
  onConnect: (token: string) => void;
  onDisconnect: () => void;
  onSelectGuild: (guildId: string) => void;
  onSelectChannel: (channelId: string) => void;
}

export function DiscordPanel({
  connected,
  connecting,
  guilds,
  channels,
  selectedGuild,
  selectedChannel,
  onConnect,
  onDisconnect,
  onSelectGuild,
  onSelectChannel,
}: DiscordPanelProps) {
  const [tokenInput, setTokenInput] = useState("");

  const handleConnect = () => {
    if (tokenInput.trim()) {
      onConnect(tokenInput.trim());
      setTokenInput("");
    }
  };

  if (!connected) {
    return (
      <div className="flex flex-col gap-3 w-full">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-text-muted/40" />
          <p className="text-xs text-text-muted">Not connected</p>
        </div>
        <input
          type="password"
          placeholder="Paste bot token..."
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-border text-xs text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent/60 transition-colors"
        />
        <button
          onClick={handleConnect}
          disabled={!tokenInput.trim() || connecting}
          className={cn(
            "flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
            "bg-accent/90 text-white hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {connecting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plug className="w-3.5 h-3.5" />
          )}
          {connecting ? "Connecting..." : "Connect Bot"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <p className="text-xs text-success font-medium">Connected</p>
        </div>
        <button
          onClick={onDisconnect}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-text-muted/60 hover:text-record hover:bg-record/8 transition-colors cursor-pointer"
        >
          <Unplug className="w-3 h-3" />
          Disconnect
        </button>
      </div>

      {/* Server selector */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-text-muted/70 uppercase tracking-wider">
          Server
        </label>
        <div className="relative">
          <select
            value={selectedGuild ?? ""}
            onChange={(e) => onSelectGuild(e.target.value)}
            className="w-full px-3 py-2 pr-8 rounded-lg bg-bg-primary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/60 appearance-none cursor-pointer transition-colors"
          >
            <option value="" disabled>
              Select server...
            </option>
            {guilds.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted/40 pointer-events-none" />
        </div>
      </div>

      {/* Channel selector */}
      {selectedGuild && (
        <div className="space-y-1.5 animate-fade-in">
          <label className="text-[10px] font-medium text-text-muted/70 uppercase tracking-wider">
            Voice Channel
          </label>
          <div className="relative">
            <select
              value={selectedChannel ?? ""}
              onChange={(e) => onSelectChannel(e.target.value)}
              className="w-full px-3 py-2 pr-8 rounded-lg bg-bg-primary border border-border text-xs text-text-primary focus:outline-none focus:border-accent/60 appearance-none cursor-pointer transition-colors"
            >
              <option value="" disabled>
                Select channel...
              </option>
              {channels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  # {ch.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted/40 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Ready indicator */}
      {selectedChannel && (
        <div className="flex items-center gap-2 pt-1 animate-fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          <p className="text-[11px] text-success/80">Ready to record</p>
        </div>
      )}
    </div>
  );
}
