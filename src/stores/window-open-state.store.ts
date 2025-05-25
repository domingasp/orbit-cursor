import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export enum AppWindow {
  StartRecordingDock = "start-recording-dock",
  RecordingInputOptions = "recording-input-options",
}

const STORE_NAME = "windowOpenState";

type WindowOpenState = {
  addWindow: (id: AppWindow, initial: boolean) => void;
  setWindowOpenState: (id: AppWindow, state: boolean) => void;
  windows: { [window: string]: boolean };
};

/**
 * Some windows (panels) are not closed rather hidden, this does not cause
 * a remount of components. Use this to listen to window open state.
 */
export const useWindowReopenStore = create<WindowOpenState>()(
  devtools(
    persist(
      (set, get) => ({
        addWindow: (id, initial) => {
          const windows = get().windows;
          set({
            windows: {
              ...windows,
              [id]: initial,
            },
          });
        },
        setWindowOpenState: (id, state) => {
          const windows = get().windows;
          set({
            windows: {
              ...windows,
              [id]: state,
            },
          });
        },
        windows: {},
      }),
      { name: STORE_NAME }
    )
  )
);
