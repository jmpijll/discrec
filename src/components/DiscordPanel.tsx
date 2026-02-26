import { useState } from "react";
import { Plug, Unplug, Loader2 } from "lucide-react";
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
      <div className="flex flex-col items-center gap-3 w-full max-w-[240px]">
        <p className="text-xs text-text-muted">Enter bot token to connect</p>
        <input
          type="password"
          placeholder="Bot token..."
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          className="w-full px-3 py-2 rounded-lg bg-bg-elevated border border-border text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent"
        />
        <button
          onClick={handleConnect}
          disabled={!tokenInput.trim() || connecting}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
            "bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {connecting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plug className="w-3.5 h-3.5" />
          )}
          {connecting ? "Connecting..." : "Connect"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full max-w-[240px]">
      {/* Server selector */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
          Server
        </label>
        <select
          value={selectedGuild ?? ""}
          onChange={(e) => onSelectGuild(e.target.value)}
          className="w-full px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-xs text-text-primary focus:outline-none focus:border-accent appearance-none cursor-pointer"
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
      </div>

      {/* Channel selector */}
      {selectedGuild && (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            Voice Channel
          </label>
          <select
            value={selectedChannel ?? ""}
            onChange={(e) => onSelectChannel(e.target.value)}
            className="w-full px-3 py-1.5 rounded-md bg-bg-elevated border border-border text-xs text-text-primary focus:outline-none focus:border-accent appearance-none cursor-pointer"
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
        </div>
      )}

      {/* Disconnect */}
      <button
        onClick={onDisconnect}
        className="flex items-center justify-center gap-1.5 px-3 py-1.5 mt-1 rounded-md text-[10px] font-medium text-text-muted hover:text-record hover:bg-record/10 transition-colors cursor-pointer"
      >
        <Unplug className="w-3 h-3" />
        Disconnect
      </button>
    </div>
  );
}
