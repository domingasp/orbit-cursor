import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { MonitorDetails } from "../features/recording-source/api/recording-sources";

const STORE_NAME = "recordingPreferences";

export enum RecordingType {
  Region = "region",
  Window = "window",
  Screen = "screen",
}

type RecordingPreferencesState = {
  camera: boolean;
  microphone: boolean;
  recordingType: RecordingType;
  selectedMonitor: MonitorDetails | null;
  setCamera: (camera: boolean) => void;
  setMicrophone: (microphone: boolean) => void;
  setRecordingType: (recordingType: RecordingType) => void;
  setSelectedMonitor: (selectedMonitor: MonitorDetails) => void;
  setSystemAudio: (systemAudio: boolean) => void;
  systemAudio: boolean;
};

export const useRecordingPreferencesStore = create<RecordingPreferencesState>()(
  devtools(
    persist(
      (set) => ({
        camera: false,
        microphone: false,
        recordingType: RecordingType.Region,
        selectedMonitor: null,
        setCamera: (camera) => {
          set({ camera });
        },
        setMicrophone: (microphone) => {
          set({ microphone });
        },
        setRecordingType: (recordingType) => {
          set({ recordingType });
        },
        setSelectedMonitor: (selectedMonitor) => {
          set({ selectedMonitor });
        },
        setSystemAudio: (systemAudio) => {
          set({ systemAudio });
        },
        systemAudio: false,
      }),
      { name: STORE_NAME }
    )
  )
);

export const rehydrateRecordingPreferencesStore = (e: StorageEvent) => {
  const { key } = e;
  if (key === STORE_NAME) {
    void useRecordingPreferencesStore.persist.rehydrate();
  }
};
