import { Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Volume2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import Switch from "../../../components/switch/switch";
import { cn } from "../../../lib/styling";
import { useRecordingPreferencesStore } from "../../../stores/recording-preferences.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../../stores/window-open-state.store";
import { Events } from "../../../types/events";
import {
  AudioStream,
  AudioStreamChannel,
  startAudioListener,
  stopAudioListener,
} from "../api/audio-listeners";
import { usePeak } from "../hooks/use-peak";

import AudioMeter from "./audio-meter";

const SystemAudioToggle = () => {
  const channel = useRef<Channel<AudioStreamChannel>>(null);
  const startRecordingDockOpened = useWindowReopenStore(
    useShallow((state) => state.windows.get(AppWindow.StartRecordingDock))
  );

  const [systemAudio, setSystemAudio] = useRecordingPreferencesStore(
    useShallow((state) => [state.systemAudio, state.setSystemAudio])
  );

  const [decibels, setDecibels] = useState<number | undefined>(undefined);
  const peak = usePeak({ decibels: decibels ?? -Infinity });

  useEffect(() => {
    const unlistenSystemAudioStreamError = listen(
      Events.SystemAudioStreamError,
      () => {
        setSystemAudio(false);
      }
    );

    return () => {
      void unlistenSystemAudioStreamError.then((f) => {
        f();
      });
    };
  }, []);

  useEffect(() => {
    if (startRecordingDockOpened && systemAudio) {
      channel.current = new Channel<AudioStreamChannel>();
      channel.current.onmessage = (message) => {
        setDecibels(message.data.decibels);
      };

      startAudioListener(AudioStream.System, channel.current);
    } else {
      void stopAudioListener(AudioStream.System);
      setDecibels(undefined);
    }
  }, [systemAudio, startRecordingDockOpened]);

  return (
    <div className="flex flex-col gap-1 min-w-full">
      <div className="flex flex-row gap-2">
        <Switch
          className="justify-between w-full pl-2 py-1"
          isSelected={systemAudio}
          onChange={setSystemAudio}
          size="xs"
        >
          <div
            className={cn(
              "flex flex-row gap-2 transition-colors",
              systemAudio ? "text-content-fg" : "text-muted/75"
            )}
          >
            <Volume2Icon size={14} />
            System Audio
          </div>
        </Switch>
      </div>

      <AudioMeter
        decibels={decibels ?? -Infinity}
        disabled={!systemAudio}
        height={5}
        peak={peak}
        width="100%"
      />
    </div>
  );
};

export default SystemAudioToggle;
