import { Key } from "react-aria";
import { create } from "zustand";
import { devtools, persist, StorageValue } from "zustand/middleware";

const STORE_NAME = "standaloneListBoxesStore";

export enum StandaloneListBoxes {
  MicrophoneAudio = "microphone-audio",
  Camera = "camera",
}

export type Item = { id: Key | null; label: string };

type StandaloneListBox = {
  items: Item[];
  label: string;
  selectedItems: Item[];
};

type StandaloneListBoxesState = {
  addListBox: (id: string, label: string) => void;
  closeListBox: () => void;
  getListBox: (id: string) => StandaloneListBox | null;
  listBoxes: Map<string, StandaloneListBox>;
  openListBox: (id: string) => void;
  openListBoxId: string | null;
  removeListBox: (id: string) => void;
  setItems: (id: string, items: Item[]) => void;
  setSelectedItems: (id: string, selectedItems: Item[]) => void;
};

export const useStandaloneListBoxStore = create<StandaloneListBoxesState>()(
  devtools(
    persist(
      (set, get) => ({
        addListBox: (id, label) => {
          const listBoxes = get().listBoxes;
          if (listBoxes.has(id)) return;

          set({
            listBoxes: new Map(listBoxes).set(id, {
              items: [],
              label,
              selectedItems: [],
            }),
          });
        },
        closeListBox: () => {
          if (get().openListBoxId === null) return;
          set({ openListBoxId: null });
        },
        getListBox: (id) => {
          const listBoxes = get().listBoxes;
          return listBoxes.get(id) ?? null;
        },
        listBoxes: new Map<string, StandaloneListBox>(),
        openListBox: (id) => {
          if (!get().listBoxes.has(id)) return;
          set({ openListBoxId: id });
        },
        openListBoxId: null,
        removeListBox: (id) => {
          const listBoxes = get().listBoxes;
          if (!listBoxes.has(id)) return;

          const next = new Map(listBoxes);
          next.delete(id);
          set({ listBoxes: next });
        },
        setItems: (id, items) => {
          const listBoxes = get().listBoxes;
          const listBox = listBoxes.get(id);
          if (!listBox) return;

          set({
            listBoxes: new Map(listBoxes).set(id, {
              ...listBox,
              items,
            }),
          });
        },
        setSelectedItems: (id, selectedItems) => {
          const listBoxes = get().listBoxes;
          const listBox = listBoxes.get(id);
          if (!listBox) return;

          set({
            listBoxes: new Map(listBoxes).set(id, {
              ...listBox,
              selectedItems,
            }),
          });
        },
      }),
      {
        name: STORE_NAME,
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;

            const existingValue = JSON.parse(
              str
            ) as StorageValue<StandaloneListBoxesState>;

            return {
              ...existingValue,
              state: {
                ...existingValue.state,
                listBoxes: new Map(existingValue.state.listBoxes),
                openListBoxId: existingValue.state.openListBoxId,
              },
            };
          },
          removeItem: (name) => {
            localStorage.removeItem(name);
          },
          setItem: (name, newValue: StorageValue<StandaloneListBoxesState>) => {
            const str = JSON.stringify({
              ...newValue,
              state: {
                ...newValue.state,
                listBoxes: Array.from(newValue.state.listBoxes.entries()),
              },
            });
            localStorage.setItem(name, str);
          },
        },
      }
    )
  )
);

export const updateStandaloneListBoxStore = (e: StorageEvent) => {
  const { key } = e;
  if (key === STORE_NAME) {
    void useStandaloneListBoxStore.persist.rehydrate();
  }
};

/**
 * Returns id of first selected item.
 */
export const selectedItem = (selectedItems: Item[]) => {
  if (selectedItems.length === 0) return null;
  return selectedItems[0];
};
