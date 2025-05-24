import { Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  Item,
  selectedItem,
  useStandaloneListBoxStore,
} from "../../../../stores/standalone-listbox.store";
import { Events } from "../../../../types/events";
import {
  AudioStream,
  AudioStreamChannel,
  listAudioInputs,
  startAudioListener,
  stopAudioListener,
} from "../../api/audio-listeners";
import { usePeak } from "../../hooks/use-peak";
import { ListBoxes } from "../../types";
import InputSelect from "../input-select";

import AudioMeter from "./audio-meter";

const InputAudioSelect = () => {
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
    if (!isDockOpen) return;

    const selectedDevice = selectedItem(selectedItems);
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
        setSelectedItems(ListBoxes.MicrophoneAudio, []);
      }
    );

    return () => {
      void unlistenInputAudioStreamError.then((f) => {
        f();
      });
    };
  }, []);

  return (
    <div className="flex flex-col gap-1 min-w-full">
      <InputSelect
        fetchItems={fetchItems}
        icon={<Mic size={14} />}
        id={ListBoxes.MicrophoneAudio}
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

export default InputAudioSelect;
