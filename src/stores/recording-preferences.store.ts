import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const STORE_NAME = "recordingPreferences";

type RecordingPreferencesState = {
  setSystemAudio: (systemAudio: boolean) => void;
  systemAudio: boolean;
};

export const useRecordingPreferencesStore = create<RecordingPreferencesState>()(
  devtools(
    persist(
      (set) => ({
        setSystemAudio: (systemAudio: boolean) => {
          set({ systemAudio });
        },
        systemAudio: false,
      }),
      { name: STORE_NAME }
    )
  )
);
