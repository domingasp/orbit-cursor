import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const STORE_NAME = "regionSelectorState";

type RegionSelectorState = {
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
};

export const useRegionSelectorStore = create<RegionSelectorState>()(
  devtools(
    persist(
      (set) => ({
        isEditing: false,
        setIsEditing: (isEditing) => { set({ isEditing }); },
      }),
      { name: STORE_NAME }
    )
  )
);

export const rehydrateRegionSelectorState = (e: StorageEvent) => {
  const { key } = e;
  if (key === STORE_NAME) {
    void useRegionSelectorStore.persist.rehydrate();
  }
};
