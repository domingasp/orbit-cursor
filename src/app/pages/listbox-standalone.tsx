import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Selection } from "react-aria-components";
import { useShallow } from "zustand/react/shallow";

import ListBox from "../../components/listbox/listbox";
import ListBoxItem from "../../components/listbox-item/listbox-item";
import {
  SelectedItem,
  updateStandaloneListBoxStore,
  useStandaloneListBoxStore,
} from "../../stores/standalone-listbox.store";

const MAX_HEIGHT = 110;
const PADDING = 2;

const StandaloneListBox = () => {
  const listBoxRef = useRef<HTMLDivElement>(null);
  const [openListBoxId, setSelectedItems] = useStandaloneListBoxStore(
    useShallow((state) => [state.openListBoxId, state.setSelectedItems])
  );

  const webview = getCurrentWindow();

  const listBox = useStandaloneListBoxStore((state) =>
    openListBoxId ? state.getListBox(openListBoxId) : undefined
  );

  // TASK dynamic fetch based on listbox id
  const items =
    openListBoxId === "system-audio"
      ? [
          { id: 1, label: "hello" },
          { id: 2, label: "world" },
        ]
      : [
          { id: 1, label: "hello" },
          { id: 2, label: "world" },
          { id: 3, label: "!" },
          { id: 4, label: "!" },
          { id: 5, label: "hello" },
        ];

  const onSelectionChange = (ids: Selection) => {
    const selectedItems: SelectedItem[] = [];
    for (const id of ids) {
      const item = items.find((x) => x.id === id);
      if (item) selectedItems.push(item);
    }

    if (openListBoxId) setSelectedItems(openListBoxId, selectedItems);
  };

  /**
   * We adjust the height of the window to match content.
   * No way to know ahead of time.
   */
  const adjustWebviewHeight = async (height: number) => {
    const finalHeight =
      (Math.min(height, MAX_HEIGHT) + PADDING) * devicePixelRatio;
    const { width } = await webview.innerSize();
    await webview.setSize(new PhysicalSize(width, finalHeight));
  };

  useEffect(() => {
    window.addEventListener("storage", updateStandaloneListBoxStore);
    return () => {
      window.removeEventListener("storage", updateStandaloneListBoxStore);
    };
  }, []);

  useLayoutEffect(() => {
    // Unbound webview height to allow proper calculation
    void adjustWebviewHeight(MAX_HEIGHT).then(async () => {
      const listBoxContainer = listBoxRef.current;
      if (!listBoxContainer) return;

      listBoxContainer.style.height = "auto";
      const scrollHeight = listBoxContainer.scrollHeight;
      const target = Math.min(scrollHeight, MAX_HEIGHT) + PADDING;

      // Use 100vh to ensure overflow can be scrolled
      if (target > MAX_HEIGHT) listBoxContainer.style.height = "100vh";
      else listBoxContainer.style.height = `${target.toString()}px`;

      await adjustWebviewHeight(target);

      requestAnimationFrame(() => {
        document
          .querySelector('[aria-selected="true"]')
          ?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    });
  }, [openListBoxId]);

  return (
    listBox && (
      <ListBox
        ref={listBoxRef}
        aria-label={listBox.label}
        onSelectionChange={onSelectionChange}
        selectionMode="single"
        selectedKeys={
          new Set(listBox.selectedItems.map(({ id }) => id)) as Selection
        }
      >
        {items.map((item) => (
          <ListBoxItem
            key={item.id}
            id={item.id}
            size="sm"
            textValue={item.label}
            compact
          >
            {item.label}
          </ListBoxItem>
        ))}
      </ListBox>
    )
  );
};

export default StandaloneListBox;
