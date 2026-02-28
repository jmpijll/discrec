import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { X, Bot, Music, Clock, Zap, Check, Loader2, Sun, Moon, FolderOpen, RotateCcw, VolumeX, Timer, Bell } from "lucide-react";
import { useUpdater } from "../hooks/useUpdater";
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
  const updater = useUpdater();
  const [outputDir, setOutputDir] = useState("");
  const [isCustomDir, setIsCustomDir] = useState(false);
  const [silenceTrim, setSilenceTrim] = useState(false);
  const [maxDuration, setMaxDuration] = useState<number | null>(null);
  const [recordKey, setRecordKey] = useState("ctrl+r");
  const [stopKey, setStopKey] = useState("ctrl+s");
  const [capturingKey, setCapturingKey] = useState<"record" | "stop" | null>(null);
  const [notifyOnRecord, setNotifyOnRecord] = useState(false);

  useEffect(() => {
    let cancelled = false;
    invoke<{ path: string; is_custom: boolean }>("get_output_dir").then((info) => {
      if (!cancelled) {
        setOutputDir(info.path);
        setIsCustomDir(info.is_custom);
      }
    }).catch(() => {});
    invoke<boolean>("get_silence_trim").then((val) => {
      if (!cancelled) setSilenceTrim(val);
    }).catch(() => {});
    invoke<number | null>("get_max_duration").then((val) => {
      if (!cancelled) setMaxDuration(val);
    }).catch(() => {});
    invoke<{ record: string; stop: string }>("get_shortcuts").then((s) => {
      if (!cancelled) { setRecordKey(s.record); setStopKey(s.stop); }
    }).catch(() => {});
    invoke<boolean>("get_notify_on_record").then((val) => {
      if (!cancelled) setNotifyOnRecord(val);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleBrowseDir = async () => {
    const selected = await open({ directory: true, title: "Choose recordings folder" });
    if (selected) {
      try {
        const info = await invoke<{ path: string; is_custom: boolean }>("set_output_dir", { path: selected });
        setOutputDir(info.path);
        setIsCustomDir(info.is_custom);
      } catch { /* ignore */ }
    }
  };

  const handleSilenceTrim = async (enabled: boolean) => {
    try {
      const val = await invoke<boolean>("set_silence_trim", { enabled });
      setSilenceTrim(val);
    } catch { /* ignore */ }
  };

  const handleResetDir = async () => {
    try {
      const info = await invoke<{ path: string; is_custom: boolean }>("set_output_dir", { path: null });
      setOutputDir(info.path);
      setIsCustomDir(info.is_custom);
    } catch { /* ignore */ }
  };

  const handleMaxDuration = async (seconds: number | null) => {
    try {
      const val = await invoke<number | null>("set_max_duration", { seconds });
      setMaxDuration(val);
    } catch { /* ignore */ }
  };

  const handleKeyCapture = (target: "record" | "stop") => {
    setCapturingKey(target);
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.key === "Escape") { setCapturingKey(null); window.removeEventListener("keydown", handler); return; }
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("ctrl");
      if (e.shiftKey) parts.push("shift");
      if (e.altKey) parts.push("alt");
      const key = e.key.toLowerCase();
      if (!["control", "shift", "alt", "meta"].includes(key)) parts.push(key);
      if (parts.length > 0 && parts[parts.length - 1] !== "ctrl" && parts[parts.length - 1] !== "shift" && parts[parts.length - 1] !== "alt") {
        const combo = parts.join("+");
        const newRecord = target === "record" ? combo : recordKey;
        const newStop = target === "stop" ? combo : stopKey;
        invoke("set_shortcuts", { record: newRecord, stop: newStop }).catch(() => {});
        if (target === "record") setRecordKey(combo); else setStopKey(combo);
        setCapturingKey(null);
      }
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("keydown", handler);
  };

  const handleNotifyOnRecord = async (enabled: boolean) => {
    try {
      const val = await invoke<boolean>("set_notify_on_record", { enabled });
      setNotifyOnRecord(val);
    } catch { /* ignore */ }
  };

  const durationOptions: { label: string; value: number | null }[] = [
    { label: "No limit", value: null },
    { label: "5 min", value: 300 },
    { label: "15 min", value: 900 },
    { label: "30 min", value: 1800 },
    { label: "1 hour", value: 3600 },
    { label: "2 hours", value: 7200 },
  ];

  const updateLabel =
    updater.status === "up-to-date" ? "Up to date" :
    updater.status === "available" ? `v${updater.version} available` :
    updater.status === "checking" ? "Checking…" :
    updater.status === "downloading" ? `Updating ${(updater.progress / 1024 / 1024).toFixed(1)} MB` :
    updater.status === "ready" ? "Restarting…" :
    updater.status === "error" ? "Update failed" :
    "Check for updates";

  return (
    <div className="absolute inset-0 bg-bg-primary/97 backdrop-blur-md z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <h2 className="text-[13px] font-semibold text-text-primary tracking-tight">
          Settings
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted/50 hover:text-text-primary transition-all cursor-pointer"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted/50 hover:text-text-primary transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings content */}
      <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto">
        {/* Discord Bot — card */}
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

          {/* Notify on record toggle — only when connected */}
          {discordConnected && (
            <div className="border-t border-border/30 pt-3">
              <button
                onClick={() => handleNotifyOnRecord(!notifyOnRecord)}
                className="flex items-center justify-between w-full cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Bell className={cn("w-3.5 h-3.5", notifyOnRecord ? "text-success" : "text-text-muted/40")} />
                  <div className="text-left">
                    <p className="text-[11px] font-medium text-text-primary leading-tight">Notify channel</p>
                    <p className="text-[9px] text-text-muted/50 leading-tight mt-0.5">Post message when recording starts</p>
                  </div>
                </div>
                <div
                  className={cn(
                    "w-8 h-[18px] rounded-full transition-colors relative",
                    notifyOnRecord ? "bg-success" : "bg-border"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform",
                      notifyOnRecord ? "translate-x-[16px]" : "translate-x-[2px]"
                    )}
                  />
                </div>
              </button>
            </div>
          )}

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

        {/* Recording — consolidated card */}
        <div className="rounded-xl bg-bg-card border border-border/50 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-success/10">
              <Music className="w-3.5 h-3.5 text-success" />
            </div>
            <div>
              <p className="text-xs font-semibold text-text-primary leading-tight">
                Recording
              </p>
              <p className="text-[10px] text-text-muted/60 leading-tight mt-0.5">
                Format, output, and processing
              </p>
            </div>
          </div>

          {/* Format selector */}
          <div className="border-t border-border/30 pt-3">
            <FormatSelector value={format} onChange={onFormatChange} />
          </div>

          {/* Output directory */}
          <div className="border-t border-border/30 pt-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-text-muted/40 shrink-0" />
              <p className="text-[10px] text-text-muted/60 truncate flex-1" title={outputDir}>
                {outputDir || "Loading…"}
              </p>
              {isCustomDir && (
                <button
                  onClick={handleResetDir}
                  className="p-1 rounded hover:bg-bg-elevated text-text-muted/40 hover:text-text-primary transition-all cursor-pointer"
                  title="Reset to default"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={handleBrowseDir}
                className="px-2.5 py-1 rounded-md bg-bg-primary border border-border/50 text-[10px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-all cursor-pointer shrink-0"
              >
                Browse…
              </button>
            </div>
          </div>

          {/* Silence trim toggle */}
          <div className="border-t border-border/30 pt-3">
            <button
              onClick={() => handleSilenceTrim(!silenceTrim)}
              className="flex items-center justify-between w-full cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <VolumeX className={cn("w-3.5 h-3.5", silenceTrim ? "text-success" : "text-text-muted/40")} />
                <span className="text-[11px] font-medium text-text-primary">Trim silence</span>
                <span className="text-[9px] text-text-muted/50">Strip leading & trailing</span>
              </div>
              <div
                className={cn(
                  "w-8 h-[18px] rounded-full transition-colors relative",
                  silenceTrim ? "bg-success" : "bg-border"
                )}
              >
                <div
                  className={cn(
                    "absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform",
                    silenceTrim ? "translate-x-[16px]" : "translate-x-[2px]"
                  )}
                />
              </div>
            </button>
          </div>

          {/* Max duration */}
          <div className="border-t border-border/30 pt-3">
            <div className="flex items-center gap-2">
              <Timer className="w-3.5 h-3.5 text-text-muted/40 shrink-0" />
              <span className="text-[11px] font-medium text-text-primary">Max duration</span>
              <div className="flex-1" />
              <select
                value={maxDuration ?? ""}
                onChange={(e) => handleMaxDuration(e.target.value ? Number(e.target.value) : null)}
                className="text-[10px] bg-bg-primary border border-border/50 rounded-md px-2 py-1 text-text-secondary cursor-pointer outline-none"
              >
                {durationOptions.map((opt) => (
                  <option key={opt.label} value={opt.value ?? ""}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Keyboard shortcuts */}
          <div className="border-t border-border/30 pt-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-muted flex-1">Record</span>
              <button
                onClick={() => handleKeyCapture("record")}
                className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded border transition-all cursor-pointer",
                  capturingKey === "record"
                    ? "border-accent bg-accent/10 text-accent animate-pulse"
                    : "border-border/50 bg-bg-primary text-text-muted/70 hover:border-accent/50"
                )}
              >
                {capturingKey === "record" ? "Press key…" : recordKey}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-text-muted flex-1">Stop</span>
              <button
                onClick={() => handleKeyCapture("stop")}
                className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded border transition-all cursor-pointer",
                  capturingKey === "stop"
                    ? "border-accent bg-accent/10 text-accent animate-pulse"
                    : "border-border/50 bg-bg-primary text-text-muted/70 hover:border-accent/50"
                )}
              >
                {capturingKey === "stop" ? "Press key…" : stopKey}
              </button>
            </div>
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
      </div>

      {/* Footer — version, update, shortcuts */}
      <div className="px-5 py-2.5 border-t border-border/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-[10px] text-text-muted/30 font-medium tracking-wide shrink-0">
            DiscRec v1.3.0
          </p>
          <span className="text-text-muted/15">·</span>
          <button
            onClick={
              updater.status === "available" ? updater.installUpdate :
              (updater.status === "idle" || updater.status === "up-to-date" || updater.status === "error")
                ? updater.checkForUpdates : undefined
            }
            disabled={updater.status === "checking" || updater.status === "downloading" || updater.status === "ready"}
            className="text-[10px] text-text-muted/30 hover:text-text-muted/60 transition-colors cursor-pointer disabled:cursor-default flex items-center gap-1"
          >
            {updater.status === "checking" && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
            {updater.status === "up-to-date" && <Check className="w-2.5 h-2.5 text-success/50" />}
            {updateLabel}
          </button>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-text-muted/20 shrink-0">
          <kbd className="font-mono px-1 py-0.5 rounded bg-bg-primary/50 border border-border/30">{recordKey}</kbd>
          <span>rec</span>
          <kbd className="font-mono px-1 py-0.5 rounded bg-bg-primary/50 border border-border/30">Esc</kbd>
          <span>stop</span>
        </div>
      </div>
    </div>
  );
}
