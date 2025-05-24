import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { showStandaloneListBox } from "../../../api/windows";
import ListBoxItem from "../../../components/listbox-item/listbox-item";
import Select from "../../../components/select/select";
import {
  Item,
  selectedItem,
  useStandaloneListBoxStore,
} from "../../../stores/standalone-listbox.store";
import {
  AppWindow,
  useWindowReopenStore,
} from "../../../stores/window-open-state.store";

type InputSelectProps = {
  fetchItems: () => Item[] | Promise<Item[]>;
  id: string;
  label: string;
  placeholder: string;
  icon?: React.ReactNode;
  onChange?: (
    selectedItems: Item[],
    isDockOpen: boolean
  ) => void | Promise<void>;
};
const InputSelect = ({
  fetchItems,
  icon,
  id,
  label,
  onChange,
  placeholder,
}: InputSelectProps) => {
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
    setItems(id, items);
    openListBox(id);
  };

  useEffect(() => {
    addListBox(id, label);
  }, []);

  useEffect(() => {
    void onChange?.(
      listBox?.selectedItems ?? [],
      startRecordingDockOpened ?? false
    );
  }, [listBox?.selectedItems, startRecordingDockOpened]);

  return (
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
  );
};

export default InputSelect;
