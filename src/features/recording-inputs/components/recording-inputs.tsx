import { Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mic, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import Separator from "../../../components/separator/separator";
import {
  PermissionType,
  usePermissionsStore,
} from "../../../stores/permissions.store";
import { useRecordingPreferencesStore } from "../../../stores/recording-preferences.store";
import {
  updateStandaloneListBoxStore,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
import {
  useWindowReopenStore,
  Window,
} from "../../../stores/window-open-state.store";
import { Events } from "../../../types/events";
import {
  AudioStream,
  AudioStreamChannel,
  startAudioListener,
  stopAudioListener,
} from "../api/audio-listeners";

import AudioSelect from "./audio-select";
import AudioToggle from "./audio-toggle";
import GrantAccess from "./grant-access";

const ICON_SIZE = 14;

enum ListBoxes {
  MicrophoneAudio = "microphone-audio",
}

const RecordingInputs = () => {
  const permissions = usePermissionsStore((state) => state.permissions);
  const { closeListBox } = useStandaloneListBoxStore((state) => state);

  const [systemAudio, setSystemAudio] = useRecordingPreferencesStore(
    useShallow((state) => [state.systemAudio, state.setSystemAudio])
  );

  const startRecordingDockOpened = useWindowReopenStore(
    useShallow((state) => state.windows.get(Window.StartRecordingDock))
  );

  const [systemAudioDecibels, setSystemAudioDecibels] = useState<
    number | undefined
  >(undefined);
  const systemAudioChannel = useRef<Channel<AudioStreamChannel> | null>(null);

  useEffect(() => {
    const unlistenStandaloneListBox = listen(
      Events.ClosedStandaloneListBox,
      () => {
        closeListBox();
      }
    );

    const unlistenSystemAudioStreamError = listen(
      Events.SystemAudioStreamError,
      () => {
        setSystemAudio(false);
      }
    );

    systemAudioChannel.current = new Channel<AudioStreamChannel>();
    systemAudioChannel.current.onmessage = (message) => {
      setSystemAudioDecibels(message.data.decibels);
    };

    window.addEventListener("storage", updateStandaloneListBoxStore);
    return () => {
      window.removeEventListener("storage", updateStandaloneListBoxStore);
      void unlistenStandaloneListBox.then((f) => {
        f();
      });
      void unlistenSystemAudioStreamError.then((f) => {
        f();
      });
    };
  }, []);

  useEffect(() => {
    if (
      systemAudioChannel.current !== null &&
      startRecordingDockOpened &&
      systemAudio
    )
      startAudioListener(AudioStream.System, systemAudioChannel.current);
    else {
      stopAudioListener(AudioStream.System);
      setSystemAudioDecibels(undefined);
    }
  }, [systemAudio, startRecordingDockOpened]);

  return (
    <div className="flex flex-row px-2">
      {permissions.microphone?.hasAccess ? (
        <AudioToggle
          decibels={systemAudioDecibels}
          icon={<Volume2 size={ICON_SIZE} />}
          label="System Audio"
          onChange={setSystemAudio}
          streamName={AudioStream.System}
          value={systemAudio}
        />
      ) : (
        <GrantAccess
          permission={permissions.microphone}
          type={PermissionType.Microphone}
        />
      )}

      <Separator
        className="h-[30px] ml-6"
        orientation="vertical"
        spacing="md"
      />

      {permissions.microphone?.hasAccess ? (
        <AudioSelect
          decibels={-21}
          icon={<Mic size={ICON_SIZE} />}
          id={ListBoxes.MicrophoneAudio}
          label="Microphone audio"
          placeholder="No microphone"
        />
      ) : (
        <GrantAccess
          permission={permissions.microphone}
          type={PermissionType.Microphone}
        />
      )}
    </div>
  );
};

export default RecordingInputs;
