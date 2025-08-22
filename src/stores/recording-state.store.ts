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

type RecordingState = {
  camera: boolean;
  cameraHasWarning: boolean;
  isFinalizing: boolean;
  isRecording: boolean;
  microphone: boolean;
  microphoneHasWarning: boolean;
  recordingType: RecordingType;
  region: Region;
  selectedMonitor: MonitorDetails | null;
  selectedWindow: WindowDetails | null;
  setCamera: (camera: boolean) => void;
  setCameraHasWarning: (camera: boolean) => void;
  setIsFinalizing: (isFinalizing: boolean) => void;
  setIsRecording: (isRecording: boolean) => void;
  setMicrophone: (microphone: boolean) => void;
  setMicrophoneHasWarning: (microphone: boolean) => void;
  setRecordingType: (recordingType: RecordingType) => void;
  setRegion: (region: Region) => void;
  setSelectedMonitor: (selectedMonitor: MonitorDetails) => void;
  setSelectedWindow: (selectedWindow: WindowDetails | null) => void;
  setShowSystemCursor: (showSystemCursor: boolean) => void;
  setSystemAudio: (systemAudio: boolean) => void;
  showSystemCursor: boolean;
  systemAudio: boolean;
};

export const useRecordingStateStore = create<RecordingState>()(
  devtools(
    persist(
      (set) => ({
        camera: false,
        cameraHasWarning: false,
        isFinalizing: false,
        isRecording: false,
        microphone: false,
        microphoneHasWarning: false,
        recordingType: RecordingType.Screen,
        region: {
          position: { x: 30, y: 30 },
          size: { height: 300, width: 300 },
        },
        selectedMonitor: null,
        selectedWindow: null,
        setCamera: (camera) => {
          set({ camera });
        },
        setCameraHasWarning: (cameraHasWarning) => {
          set({ cameraHasWarning });
        },
        setIsFinalizing: (isFinalizing) => {
          set({ isFinalizing });
        },
        setIsRecording: (isRecording) => {
          set({ isRecording });
        },
        setMicrophone: (microphone) => {
          set({ microphone });
        },
        setMicrophoneHasWarning: (microphoneHasWarning) => {
          set({ microphoneHasWarning });
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
        setShowSystemCursor: (showSystemCursor) => {
          set({ showSystemCursor });
        },
        setSystemAudio: (systemAudio) => {
          set({ systemAudio });
        },
        showSystemCursor: false,
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
