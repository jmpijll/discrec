import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useDiscord } from "./hooks/useDiscord";
import { useRecorder } from "./hooks/useRecorder";
import { useKeyboardShortcuts, type ShortcutConfig } from "./hooks/useKeyboardShortcuts";
import { RecordButton } from "./components/RecordButton";
import { StatusBar } from "./components/StatusBar";
import { AudioMeter } from "./components/AudioMeter";
import { CompletedView } from "./components/CompletedView";
import { SettingsPanel } from "./components/SettingsPanel";
import { Disc3, AlertCircle, Settings } from "lucide-react";

type Theme = "dark" | "light";

function App() {
  const discord = useDiscord();
  const recorder = useRecorder();
  const [showSettings, setShowSettings] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("discrec-theme") as Theme) || "dark";
  });
  const prevMemberCount = useRef<number | null>(null);
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>({ record: "ctrl+r", stop: "ctrl+s" });

  // Load shortcuts from settings
  useEffect(() => {
    invoke<ShortcutConfig>("get_shortcuts").then(setShortcuts).catch(() => {});
  }, []);

  // Determine which mode is active
  const isDiscordMode = discord.state !== "disconnected";
  const isRecording = isDiscordMode
    ? discord.state === "recording"
    : recorder.state === "recording";
  const isDone = isDiscordMode
    ? discord.state === "done"
    : recorder.state === "done";
  const peakLevel = isDiscordMode ? discord.peakLevel : recorder.peakLevel;
  const duration = isDiscordMode ? discord.duration : recorder.duration;
  const error = isDiscordMode ? discord.error : recorder.error;

  const handleRecord = () => {
    if (isDiscordMode) {
      discord.startRecording(recorder.format);
    } else {
      recorder.startRecording();
    }
  };

  const handleStop = () => {
    if (isDiscordMode) {
      discord.stopRecording();
    } else {
      recorder.stopRecording();
    }
  };

  const handleReset = () => {
    if (isDiscordMode) {
      discord.reset();
    } else {
      recorder.reset();
    }
  };

  const canRecord = isDiscordMode
    ? discord.selectedChannel !== null
    : true;

  useKeyboardShortcuts({
    onRecord: handleRecord,
    onStop: handleStop,
    isRecording,
    canRecord,
    disabled: showSettings || isDone,
    shortcuts,
  });

  // Detect auto-stop (max duration) — poll recording status
  useEffect(() => {
    if (!isRecording || isDiscordMode) return;
    const check = setInterval(async () => {
      try {
        const status = await invoke<{ is_recording: boolean; peak_level: number }>("get_status");
        if (!status.is_recording && recorder.state === "recording") {
          recorder.stopRecording();
        }
      } catch { /* ignore */ }
    }, 1000);
    return () => clearInterval(check);
  }, [isRecording, isDiscordMode, recorder]);

  // Theme management
  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("discrec-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  }, []);

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Auto-record: poll channel member count when enabled
  useEffect(() => {
    if (!autoRecord || !isDiscordMode || !discord.selectedGuild || !discord.selectedChannel) {
      prevMemberCount.current = null;
      return;
    }
    if (isDone) return;

    const poll = async () => {
      try {
        const count = await invoke<number>("discord_get_channel_members", {
          guildId: discord.selectedGuild,
          channelId: discord.selectedChannel,
        });

        const prev = prevMemberCount.current;
        prevMemberCount.current = count;

        // Skip first poll (establishing baseline)
        if (prev === null) return;

        // Someone joined and we're not recording → start
        if (count > 0 && prev === 0 && !isRecording) {
          discord.startRecording(recorder.format);
        }
        // Everyone left and we're recording → stop
        if (count === 0 && prev > 0 && isRecording) {
          discord.stopRecording();
        }
      } catch {
        // ignore polling errors
      }
    };

    const interval = setInterval(poll, 5000);
    poll(); // initial poll
    return () => clearInterval(interval);
  }, [autoRecord, isDiscordMode, discord, isRecording, isDone, recorder.format]);

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-bg-primary">
      {/* Settings overlay */}
      {showSettings && (
        <SettingsPanel
          format={recorder.format}
          onFormatChange={recorder.setFormat}
          onClose={() => setShowSettings(false)}
          discordConnected={discord.state !== "disconnected"}
          discordConnecting={discord.connecting}
          guilds={discord.guilds}
          channels={discord.channels}
          selectedGuild={discord.selectedGuild}
          selectedChannel={discord.selectedChannel}
          onDiscordConnect={discord.connect}
          onDiscordDisconnect={discord.disconnect}
          onSelectGuild={discord.selectGuild}
          onSelectChannel={discord.setSelectedChannel}
          autoRecord={autoRecord}
          onAutoRecordChange={setAutoRecord}
          theme={theme}
          onThemeChange={handleThemeChange}
        />
      )}

      {/* Main content — clean centered view */}
      {isDone ? (
        <CompletedView
          filePath={
            isDiscordMode
              ? discord.savedPaths[0] ?? null
              : recorder.filePath
          }
          duration={duration}
          onReset={handleReset}
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          {/* Branding */}
          <div className="flex items-center gap-2.5 mb-1">
            <Disc3
              className={`w-5 h-5 text-accent ${isRecording ? "animate-spin" : ""}`}
              style={{ animationDuration: "3s" }}
            />
            <h1 className="text-[15px] font-semibold tracking-tight text-text-primary">
              DiscRec
            </h1>
          </div>

          {/* Audio meter */}
          <AudioMeter level={peakLevel} isActive={isRecording} />

          {/* Spacer for glow clearance */}
          <div className="h-3" />

          {/* Record button */}
          <RecordButton
            isRecording={isRecording}
            onClick={isRecording ? handleStop : handleRecord}
            disabled={!isRecording && !canRecord}
          />

          {/* Status text */}
          <div className="h-10 flex items-center">
            {isRecording ? (
              <StatusBar isRecording={true} duration={duration} />
            ) : (
              <p className="text-[13px] text-text-muted/70">
                {isDiscordMode
                  ? canRecord
                    ? "Press to record Discord"
                    : "Select a voice channel in settings"
                  : "Press to record Discord audio"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-record/8 border border-record/15 animate-fade-in max-w-[420px] backdrop-blur-sm">
          <AlertCircle className="w-4 h-4 text-record shrink-0" />
          <p className="text-[13px] text-record">{error}</p>
        </div>
      )}

      {/* Settings gear — bottom right */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute bottom-4 right-4 p-2.5 rounded-xl text-text-muted/30 hover:text-text-muted/70 hover:bg-bg-elevated/60 transition-all cursor-pointer"
        title="Settings"
      >
        <Settings className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}

export default App;
