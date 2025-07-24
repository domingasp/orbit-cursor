import { Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { GrantAccessOverlay } from "../../../components/shared/grant-access-overlay/grant-access-overlay";
import { InputSelect } from "../../../components/shared/input-select/input-select";
import { cn } from "../../../lib/styling";
import {
  PermissionType,
  usePermissionsStore,
} from "../../../stores/permissions.store";
import {
  Item,
  selectedItem,
  StandaloneListBoxes,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
import { Events } from "../../../types/events";
import {
  AudioStream,
  AudioStreamChannel,
  listAudioInputs,
  startAudioListener,
  stopAudioListener,
} from "../api/audio-listeners";
import { usePeak } from "../hooks/use-peak";

import { AudioMeter } from "./audio-meter";

export const InputAudioSelect = () => {
  const permission = usePermissionsStore(
    (state) => state.permissions.microphone
  );

  const channel = useRef<Channel<AudioStreamChannel>>(null);

  const [setSelectedItems] = useStandaloneListBoxStore(
    useShallow((state) => [state.setSelectedItems])
  );

  const [noDevice, setNoDevice] = useState(false);
  const [decibels, setDecibels] = useState<number | undefined>(undefined);
  const peak = usePeak({ decibels: decibels ?? -Infinity });

  const fetchItems = async (): Promise<Item[]> => {
    const audioInputs = await listAudioInputs();
    return audioInputs.map((input) => ({ id: input, label: input }));
  };

  const onChange = async (selectedItems: Item[], isDockOpen: boolean) => {
    await stopAudioListener(AudioStream.Input);
    setDecibels(undefined);
    if (!isDockOpen) return;

    const selectedDevice = selectedItem(selectedItems)?.id;
    if (selectedDevice) {
      setNoDevice(false);
      channel.current = new Channel<AudioStreamChannel>();
      channel.current.onmessage = (message) => {
        setDecibels(message.data.decibels);
      };

      startAudioListener(
        AudioStream.Input,
        channel.current,
        selectedDevice.toString()
      );
    } else {
      setDecibels(undefined);
      setNoDevice(true);
    }
  };

  useEffect(() => {
    const unlistenInputAudioStreamError = listen(
      Events.InputAudioStreamError,
      () => {
        setSelectedItems(StandaloneListBoxes.MicrophoneAudio, []);
      }
    );

    return () => {
      void unlistenInputAudioStreamError.then((f) => {
        f();
      });
    };
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col gap-1 min-w-full relative",
        !permission.hasAccess && "bg-content"
      )}
    >
      <GrantAccessOverlay
        icon={<Mic size={12} />}
        permission={permission}
        type={PermissionType.Microphone}
      />

      <InputSelect
        fetchItems={fetchItems}
        icon={<Mic size={14} />}
        id={StandaloneListBoxes.MicrophoneAudio}
        label="Microphone"
        onChange={onChange}
        placeholder="No microphone"
      />

      <AudioMeter
        decibels={decibels ?? -Infinity}
        disabled={noDevice}
        height={5}
        peak={peak}
        width="100%"
      />
    </div>
  );
};
