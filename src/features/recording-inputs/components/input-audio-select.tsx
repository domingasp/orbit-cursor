import { Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { showStandaloneListBox } from "../../../api/windows";
import ListBoxItem from "../../../components/listbox-item/listbox-item";
import Select from "../../../components/select/select";
import {
  Item,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
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

type InputAudioSelectProps = {
  fetchItems: () => Promise<string[]>;
  id: string;
  label: string;
  placeholder: string;
  icon?: React.ReactNode;
};
const InputAudioSelect = ({
  fetchItems,
  icon,
  id,
  label,
  placeholder,
}: InputAudioSelectProps) => {
  const channel = useRef<Channel<AudioStreamChannel>>(null);
  const startRecordingDockOpened = useWindowReopenStore(
    useShallow((state) => state.windows.get(AppWindow.StartRecordingDock))
  );

  const [openListBoxId, openListBox, addListBox, setSelectedItems, setItems] =
    useStandaloneListBoxStore(
      useShallow((state) => [
        state.openListBoxId,
        state.openListBox,
        state.addListBox,
        state.setSelectedItems,
        state.setItems,
      ])
    );

  const listBox = useStandaloneListBoxStore((state) => state.getListBox(id));

  const [decibels, setDecibels] = useState<number | undefined>(undefined);
  const peak = usePeak({ decibels: decibels ?? -Infinity });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const openStandaloneListBox = async () => {
    if (!triggerRef.current) return;

    const { height, left, top, width } =
      triggerRef.current.getBoundingClientRect();
    const currentWindow = getCurrentWindow();

    const { x, y } = await currentWindow.outerPosition();

    const PADDING = 4;
    await showStandaloneListBox({
      width,
      x: x + left * window.devicePixelRatio,
      y: y + (top + height + PADDING) * window.devicePixelRatio,
    });

    const items = await fetchItems();
    setItems(
      id,
      items.map((item) => ({ id: item, label: item }))
    );
    openListBox(id);
  };

  // Select only supports a single selection, hence we take the first
  // selected item
  const selectedItem = (selectedItems: Item[]) => {
    if (selectedItems.length === 0) return null;
    return selectedItems[0].id;
  };

  const onChange = async () => {
    await stopAudioListener(AudioStream.Input);

    const selectedDevice = selectedItem(listBox?.selectedItems ?? []);
    if (selectedDevice) {
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
    }
  };

  useEffect(() => {
    addListBox(id, label);

    const unlistenInputAudioStreamError = listen(
      Events.InputAudioStreamError,
      () => {
        setSelectedItems(id, []);
      }
    );

    return () => {
      void unlistenInputAudioStreamError.then((f) => {
        f();
      });
    };
  }, []);

  useEffect(() => {
    void onChange();
  }, [listBox?.selectedItems, startRecordingDockOpened]);

  return (
    <div className="flex flex-col gap-1 min-w-full">
      <Select
        aria-label={label}
        className="w-full"
        clearable={listBox?.selectedItems && listBox.selectedItems.length > 0}
        isOpen={openListBoxId === id}
        items={listBox?.selectedItems ?? []}
        leftSection={icon}
        placeholder={placeholder}
        selectedKey={selectedItem(listBox?.selectedItems ?? [])}
        size="sm"
        triggerRef={triggerRef}
        variant="ghost"
        onClear={() => {
          setSelectedItems(id, []);
        }}
        onPress={() => {
          if (openListBoxId !== id) {
            void openStandaloneListBox();
          }
        }}
        standalone
      >
        {
          // Although not rendered we need this for Select to show the selected item
          listBox?.selectedItems.map((item) => (
            <ListBoxItem
              key={item.id}
              id={item.id ?? undefined}
              textValue={item.label}
            >
              {item.label}
            </ListBoxItem>
          ))
        }
      </Select>

      <AudioMeter
        decibels={decibels ?? -Infinity}
        disabled={!selectedItem(listBox?.selectedItems ?? [])}
        height={5}
        peak={peak}
        width="100%"
      />
    </div>
  );
};

export default InputAudioSelect;
