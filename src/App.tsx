import { useRecorder } from "./hooks/useRecorder";
import { RecordButton } from "./components/RecordButton";
import { StatusBar } from "./components/StatusBar";
import { AudioMeter } from "./components/AudioMeter";
import { CompletedView } from "./components/CompletedView";
import { FormatSelector } from "./components/FormatSelector";
import { Disc3, AlertCircle } from "lucide-react";

function App() {
  const {
    state,
    filePath,
    duration,
    peakLevel,
    error,
    format,
    setFormat,
    startRecording,
    stopRecording,
    reset,
  } = useRecorder();

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-bg-primary p-8">
      {/* Header */}
      <div className="flex items-center gap-2.5 pt-2">
        <Disc3
          className={`w-7 h-7 text-accent ${state === "recording" ? "animate-spin" : ""}`}
          style={{ animationDuration: "3s" }}
        />
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          DiscRec
        </h1>
      </div>

      {/* Main Content */}
      <div className="flex flex-col items-center gap-8 -mt-4">
        {state === "done" ? (
          <CompletedView
            filePath={filePath}
            duration={duration}
            onReset={reset}
          />
        ) : (
          <>
            {/* Audio Meter */}
            <AudioMeter level={peakLevel} isActive={state === "recording"} />

            {/* Record Button */}
            <RecordButton
              isRecording={state === "recording"}
              onClick={state === "recording" ? stopRecording : startRecording}
            />

            {/* Status + Format */}
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 flex items-center">
                {state === "recording" ? (
                  <StatusBar isRecording={true} duration={duration} />
                ) : (
                  <p className="text-sm text-text-muted">
                    Press to record Discord audio
                  </p>
                )}
              </div>

              {state === "idle" && (
                <FormatSelector
                  value={format}
                  onChange={setFormat}
                />
              )}
            </div>
          </>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-record/10 border border-record/20 animate-fade-in max-w-[400px]">
            <AlertCircle className="w-4 h-4 text-record shrink-0" />
            <p className="text-xs text-record">{error}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-xs text-text-muted/50 pb-2">
        v0.2.0
      </p>
    </div>
  );
}

export default App;
