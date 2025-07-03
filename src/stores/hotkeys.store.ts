import { platform } from "@tauri-apps/plugin-os";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const STORE_NAME = "hotkeys";

export const getPlatform = (): keyof PlatformHotkeys => {
  const p = platform();
  if (p === "macos") return "macos";
  return "windows";
};

export type PlatformHotkeys = { macos: string; windows: string };

type ActionMetadata = {
  defaultHotkey: PlatformHotkeys;
  description: string;
};

export enum AvailableActions {
  EditorTogglePlay = "editor.togglePlay",
  EditorBackToStart = "editor.backToStart",
}

export const ActionsMetadata: Record<AvailableActions, ActionMetadata> = {
  [AvailableActions.EditorBackToStart]: {
    defaultHotkey: { macos: "meta+left", windows: "ctrl+left" },
    description: "Sets the play head to the beginning of the recording.",
  },
  [AvailableActions.EditorTogglePlay]: {
    defaultHotkey: { macos: "space", windows: "space" },
    description: "Toggles the pause/play state of the video.",
  },
};

const getDefaultHotkeys = (): Record<AvailableActions, string> =>
  Object.fromEntries(
    Object.entries(ActionsMetadata).map(([action, meta]) => [
      action,
      meta.defaultHotkey[getPlatform()],
    ])
  ) as Record<AvailableActions, string>;

type HotkeyStore = {
  getHotkey: (action: AvailableActions) => string;
  hotkeys: Record<AvailableActions, string>;
};

export const useHotkeyStore = create<HotkeyStore>()(
  devtools(
    persist(
      (_set, get) => ({
        getHotkey: (action) => get().hotkeys[action],
        hotkeys: getDefaultHotkeys(),
      }),
      { name: STORE_NAME }
    )
  )
);

export const rehydrateHotkeyStore = (e: StorageEvent) => {
  const { key } = e;
  if (key === STORE_NAME) {
    void useHotkeyStore.persist.rehydrate();
  }
};
