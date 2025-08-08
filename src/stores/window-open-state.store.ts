import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export enum AppWindow {
  StartRecordingDock = "start-recording-dock",
  RecordingInputOptions = "recording-input-options",
}

const STORE_NAME = "windowOpenState";

// Helps avoid race conditions when multiple windows attempt to update the state
const windowBroadcastChannel = new BroadcastChannel("window-open-state");

type WindowOpenState = {
  addWindow: (id: AppWindow, initial: boolean) => void;
  setWindowOpenState: (
    id: AppWindow,
    state: boolean,
    broadcast?: boolean
  ) => void;
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
        setWindowOpenState: (id, state, broadcast = true) => {
          set((current) => {
            const updated = {
              ...current.windows,
              [id]: state,
            };

            if (broadcast) {
              windowBroadcastChannel.postMessage({ id, state });
            }

            return {
              windows: updated,
            };
          });
        },
        windows: {},
      }),
      { name: STORE_NAME }
    )
  )
);

windowBroadcastChannel.onmessage = (event) => {
  const { id, state } = event.data as { id: AppWindow; state: boolean };

  // Prevent rebroadcasting the same state
  useWindowReopenStore.getState().setWindowOpenState(id, state, false);
};

export const rehydrateWindowReopenState = (e: StorageEvent) => {
  const { key } = e;
  if (key === STORE_NAME) {
    void useWindowReopenStore.persist.rehydrate();
  }
};
