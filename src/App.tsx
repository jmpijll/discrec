import { useState } from "react";
import { useDiscord } from "./hooks/useDiscord";
import { useRecorder } from "./hooks/useRecorder";
import { RecordButton } from "./components/RecordButton";
import { StatusBar } from "./components/StatusBar";
import { AudioMeter } from "./components/AudioMeter";
import { CompletedView } from "./components/CompletedView";
import { DiscordPanel } from "./components/DiscordPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { Disc3, AlertCircle, Settings } from "lucide-react";

function App() {
  const discord = useDiscord();
  const recorder = useRecorder();
  const [showSettings, setShowSettings] = useState(false);

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

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-bg-primary">
      {/* Settings overlay */}
      {showSettings && (
        <SettingsPanel
          format={recorder.format}
          onFormatChange={recorder.setFormat}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Main content — landscape row */}
      <div className="flex items-center gap-8 px-8">
        {/* Left: branding + discord panel / meter */}
        <div className="flex flex-col items-center gap-4 min-w-[240px]">
          <div className="flex items-center gap-2">
            <Disc3
              className={`w-6 h-6 text-accent ${isRecording ? "animate-spin" : ""}`}
              style={{ animationDuration: "3s" }}
            />
            <h1 className="text-lg font-bold tracking-tight text-text-primary">
              DiscRec
            </h1>
          </div>

          {!isDone && (
            <>
              {isDiscordMode ? (
                <DiscordPanel
                  connected={discord.state !== "disconnected"}
                  connecting={discord.connecting}
                  guilds={discord.guilds}
                  channels={discord.channels}
                  selectedGuild={discord.selectedGuild}
                  selectedChannel={discord.selectedChannel}
                  onConnect={discord.connect}
                  onDisconnect={discord.disconnect}
                  onSelectGuild={discord.selectGuild}
                  onSelectChannel={discord.setSelectedChannel}
                />
              ) : (
                <DiscordPanel
                  connected={false}
                  connecting={discord.connecting}
                  guilds={[]}
                  channels={[]}
                  selectedGuild={null}
                  selectedChannel={null}
                  onConnect={discord.connect}
                  onDisconnect={discord.disconnect}
                  onSelectGuild={() => {}}
                  onSelectChannel={() => {}}
                />
              )}
            </>
          )}
        </div>

        {/* Right: meter + record button + status */}
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
            <AudioMeter level={peakLevel} isActive={isRecording} />
            <RecordButton
              isRecording={isRecording}
              onClick={isRecording ? handleStop : handleRecord}
              disabled={!isRecording && !canRecord}
            />
            <div className="h-8 flex items-center">
              {isRecording ? (
                <StatusBar isRecording={true} duration={duration} />
              ) : (
                <p className="text-xs text-text-muted">
                  {canRecord
                    ? "Press to record"
                    : "Select a voice channel"}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-lg bg-record/10 border border-record/20 animate-fade-in max-w-[400px]">
          <AlertCircle className="w-4 h-4 text-record shrink-0" />
          <p className="text-xs text-record">{error}</p>
        </div>
      )}

      {/* Settings gear — bottom right */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute bottom-3 right-3 p-2 rounded-lg text-text-muted/40 hover:text-text-muted hover:bg-bg-elevated transition-colors cursor-pointer"
        title="Settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
}

export default App;
