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

export const availableActions = {
  EDITOR_BACK_TO_START: "editor.backToStart",
  EDITOR_EXPORT: "editor.export",
  EDITOR_TOGGLE_PLAY: "editor.togglePlay",
} as const;

export type AvailableActions =
  (typeof availableActions)[keyof typeof availableActions];

export const ActionsMetadata: Record<AvailableActions, ActionMetadata> = {
  [availableActions.EDITOR_BACK_TO_START]: {
    defaultHotkey: { macos: "meta+left", windows: "ctrl+left" },
    description: "Sets the play head to the beginning of the recording.",
  },
  [availableActions.EDITOR_TOGGLE_PLAY]: {
    defaultHotkey: { macos: "space", windows: "space" },
    description: "Toggles the pause/play state of the video.",
  },
  [availableActions.EDITOR_EXPORT]: {
    defaultHotkey: { macos: "meta+e", windows: "ctrl+e" },
    description: "Open the Export modal.",
  },
};

const getDefaultHotkeys = (): Record<AvailableActions, string> =>
  Object.fromEntries(
    Object.entries(ActionsMetadata).map(([action, meta]) => [
      action,
      meta.defaultHotkey[getPlatform()],
    ])
  ) as Record<AvailableActions, string>;

type HotkeyState = {
  getHotkey: (action: AvailableActions) => string;
  hotkeys: Record<AvailableActions, string>;
};

export const useHotkeyStore = create<HotkeyState>()(
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
