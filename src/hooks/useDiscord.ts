import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AudioFormat } from "../components/FormatSelector";

interface GuildInfo {
  id: string;
  name: string;
}

interface VoiceChannelInfo {
  id: string;
  name: string;
  guild_id: string;
}

interface DiscordStatus {
  connected: boolean;
  recording: boolean;
  peak_level: number;
}

export type DiscordState = "disconnected" | "connected" | "recording" | "done";

export function useDiscord() {
  const [state, setState] = useState<DiscordState>("disconnected");
  const [guilds, setGuilds] = useState<GuildInfo[]>([]);
  const [channels, setChannels] = useState<VoiceChannelInfo[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [peakLevel, setPeakLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [savedPaths, setSavedPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const connect = useCallback(async (token: string) => {
    try {
      setError(null);
      setConnecting(true);
      await invoke("discord_connect", { token });
      await invoke("save_bot_token", { token });
      const g = await invoke<GuildInfo[]>("discord_list_guilds");
      setGuilds(g);
      setState("connected");
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      clearTimers();
      await invoke("discord_disconnect");
      setState("disconnected");
      setGuilds([]);
      setChannels([]);
      setSelectedGuild(null);
      setSelectedChannel(null);
      setPeakLevel(0);
    } catch (e) {
      setError(String(e));
    }
  }, [clearTimers]);

  const selectGuild = useCallback(async (guildId: string) => {
    try {
      setError(null);
      setSelectedGuild(guildId);
      setSelectedChannel(null);
      const chs = await invoke<VoiceChannelInfo[]>("discord_list_channels", {
        guildId,
      });
      setChannels(chs);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const startRecording = useCallback(
    async (format: AudioFormat) => {
      if (!selectedGuild || !selectedChannel) {
        setError("Select a server and voice channel first");
        return;
      }
      try {
        setError(null);
        await invoke("discord_start_recording", {
          guildId: selectedGuild,
          channelId: selectedChannel,
          format,
        });
        setState("recording");
        setDuration(0);

        timerRef.current = setInterval(() => {
          setDuration((d) => d + 1);
        }, 1000);

        pollRef.current = setInterval(async () => {
          try {
            const status = await invoke<DiscordStatus>("discord_get_status");
            setPeakLevel(status.peak_level);
          } catch {
            // ignore
          }
        }, 50);
      } catch (e) {
        setError(String(e));
      }
    },
    [selectedGuild, selectedChannel]
  );

  const stopRecording = useCallback(async () => {
    try {
      clearTimers();
      const paths = await invoke<string[]>("discord_stop_recording");
      setSavedPaths(paths);
      setPeakLevel(0);
      setState("done");
    } catch (e) {
      setError(String(e));
    }
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setState("connected");
    setSavedPaths([]);
    setDuration(0);
    setPeakLevel(0);
    setError(null);
  }, [clearTimers]);

  // Load saved token on mount
  useEffect(() => {
    invoke<string | null>("load_bot_token").then((token) => {
      if (token) {
        connect(token);
      }
    });
    return () => clearTimers();
  }, [connect, clearTimers]);

  return {
    state,
    guilds,
    channels,
    selectedGuild,
    selectedChannel,
    peakLevel,
    duration,
    savedPaths,
    error,
    connecting,
    connect,
    disconnect,
    selectGuild,
    setSelectedChannel,
    startRecording,
    stopRecording,
    reset,
  };
}
