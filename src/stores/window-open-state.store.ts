import { create } from "zustand";
import { devtools } from "zustand/middleware";

export enum Window {
  StartRecordingDock = "start-recording-dock",
}

type WindowOpenState = {
  addWindow: (id: Window) => void;
  setWindowOpenState: (id: Window, state: boolean) => void;
  windows: Map<Window, boolean>;
};

/**
 * Some windows (panels) are not closed rather hidden, this does not cause
 * a remount of components. Use this to listen to window open state.
 */
export const useWindowReopenStore = create<WindowOpenState>()(
  devtools((set, get) => ({
    addWindow: (id) => {
      const windows = get().windows;
      if (windows.has(id)) return;
      set({ windows: new Map(windows).set(id, false) });
    },
    setWindowOpenState: (id, state) => {
      const windows = get().windows;
      set({ windows: new Map(windows).set(id, state) });
    },
    windows: new Map<Window, boolean>(),
  }))
);
