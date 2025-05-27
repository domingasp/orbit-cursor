import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

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
  setCamera: (camera: boolean) => void;
  setMicrophone: (microphone: boolean) => void;
  setRecordingType: (recordingType: RecordingType) => void;
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
        setCamera: (camera) => {
          set({ camera });
        },
        setMicrophone: (microphone) => {
          set({ microphone });
        },
        setRecordingType: (recordingType) => {
          set({ recordingType });
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
