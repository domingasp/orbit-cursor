import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import ListBoxItem from "../../../components/listbox-item/listbox-item";
import Select from "../../../components/select/select";
import {
  SelectedItem,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
import { Commands } from "../../../types/api";

import AudioMeter from "./audio-meter";

type AudioSelectProps = {
  decibels: number | undefined;
  id: string;
  label: string;
  placeholder: string;
  icon?: React.ReactNode;
};
const AudioSelect = ({
  decibels,
  icon,
  id,
  label,
  placeholder,
}: AudioSelectProps) => {
  const [openListBoxId, openListBox, addListBox, setSelectedItems] =
    useStandaloneListBoxStore(
      useShallow((state) => [
        state.openListBoxId,
        state.openListBox,
        state.addListBox,
        state.setSelectedItems,
      ])
    );

  const listBox = useStandaloneListBoxStore((state) => state.getListBox(id));

  const triggerRef = useRef<HTMLButtonElement>(null);

  const openStandaloneListBox = async () => {
    if (!triggerRef.current) return;

    const { height, left, top, width } =
      triggerRef.current.getBoundingClientRect();
    const currentWindow = getCurrentWindow();

    const { x, y } = await currentWindow.outerPosition();

    await invoke(Commands.ShowStandaloneListBox, {
      height: 100,
      width: width,
      x: x + left * window.devicePixelRatio,
      y: y + (top + height + 4) * window.devicePixelRatio,
    });

    openListBox(id);
  };

  // Select only supports a single selection, hence we take the first
  // selected item
  const selectedItem = (selectedItems: SelectedItem[]) => {
    if (selectedItems.length === 0) return null;
    return selectedItems[0].id;
  };

  useEffect(() => {
    addListBox(id, label);
  }, []);

  return (
    <div className="flex flex-col gap-1 grow basis-0">
      <Select
        aria-label={label}
        className="w-full"
        clearable={listBox?.selectedItems && listBox.selectedItems.length > 0}
        isOpen={openListBoxId === id}
        items={listBox?.selectedItems ?? []}
        leftSection={icon}
        placeholder={placeholder}
        selectedKey={listBox ? selectedItem(listBox.selectedItems) : null}
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
        height={5}
        orientation="horizontal"
        width="100%"
      />
    </div>
  );
};

export default AudioSelect;
