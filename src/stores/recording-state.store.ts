import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import {
  MonitorDetails,
  WindowDetails,
} from "../features/recording-source/api/recording-sources";

const STORE_NAME = "recordingState";

export enum RecordingType {
  Region = "region",
  Window = "window",
  Screen = "screen",
}

export type Region = {
  position: { x: number; y: number };
  size: { height: number; width: number };
};

type RecordingStateProps = {
  camera: boolean;
  isRecording: boolean;
  microphone: boolean;
  recordingType: RecordingType;
  region: Region;
  selectedMonitor: MonitorDetails | null;
  selectedWindow: WindowDetails | null;
  setCamera: (camera: boolean) => void;
  setIsRecording: (isRecording: boolean) => void;
  setMicrophone: (microphone: boolean) => void;
  setRecordingType: (recordingType: RecordingType) => void;
  setRegion: (region: Region) => void;
  setSelectedMonitor: (selectedMonitor: MonitorDetails) => void;
  setSelectedWindow: (selectedWindow: WindowDetails | null) => void;
  setSystemAudio: (systemAudio: boolean) => void;
  systemAudio: boolean;
};

export const useRecordingStateStore = create<RecordingStateProps>()(
  devtools(
    persist(
      (set) => ({
        camera: false,
        isRecording: false,
        microphone: false,
        recordingType: RecordingType.Region,
        region: {
          position: { x: 30, y: 30 },
          size: { height: 300, width: 300 },
        },
        selectedMonitor: null,
        selectedWindow: null,
        setCamera: (camera) => {
          set({ camera });
        },
        setIsRecording: (isRecording) => {
          set({ isRecording });
        },
        setMicrophone: (microphone) => {
          set({ microphone });
        },
        setRecordingType: (recordingType) => {
          set({ recordingType });
        },
        setRegion: (region: Region) => {
          set({ region });
        },
        setSelectedMonitor: (selectedMonitor) => {
          set({ selectedMonitor });
        },
        setSelectedWindow: (selectedWindow) => {
          set({ selectedWindow });
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

export const rehydrateRecordingStateStore = (e: StorageEvent) => {
  const { key } = e;
  if (key === STORE_NAME) {
    void useRecordingStateStore.persist.rehydrate();
  }
};
