import { create } from "zustand";
import { devtools } from "zustand/middleware";

export enum AppWindow {
  StartRecordingDock = "start-recording-dock",
}

type WindowOpenState = {
  addWindow: (id: AppWindow, initial: boolean) => void;
  setWindowOpenState: (id: AppWindow, state: boolean) => void;
  windows: Map<AppWindow, boolean>;
};

/**
 * Some windows (panels) are not closed rather hidden, this does not cause
 * a remount of components. Use this to listen to window open state.
 */
export const useWindowReopenStore = create<WindowOpenState>()(
  devtools((set, get) => ({
    addWindow: (id, initial) => {
      const windows = get().windows;
      if (windows.has(id)) return;
      set({ windows: new Map(windows).set(id, initial) });
    },
    setWindowOpenState: (id, state) => {
      const windows = get().windows;
      set({ windows: new Map(windows).set(id, state) });
    },
    windows: new Map<AppWindow, boolean>(),
  }))
);
