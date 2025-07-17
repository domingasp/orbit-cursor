import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const STORE_NAME = "exportPreferences";

type ExportPreferencesState = {
  defaultExportPath: string | null;
  openFolderAfterExport: boolean;
  separateAudioTracks: boolean;
  separateCameraTrack: boolean;
  setDefaultExportPath: (defaultExportPath: string | null) => void;
  setOpenFolderAfterExport: (openFolderAfterExport: boolean) => void;
  setSeparateAudioTracks: (separateAudioTracks: boolean) => void;
  setSeparateCameraTrack: (separateCameraTrack: boolean) => void;
};

export const useExportPreferencesStore = create<ExportPreferencesState>()(
  devtools(
    persist(
      (set) => ({
        defaultExportPath: null,
        openFolderAfterExport: true,
        separateAudioTracks: false,
        separateCameraTrack: false,
        setDefaultExportPath: (defaultExportPath) => {
          set({ defaultExportPath });
        },
        setOpenFolderAfterExport: (openFolderAfterExport) => {
          set({ openFolderAfterExport });
        },
        setSeparateAudioTracks: (separateAudioTracks) => {
          set({ separateAudioTracks });
        },
        setSeparateCameraTrack: (separateCameraTrack) => {
          set({ separateCameraTrack });
        },
      }),
      { name: STORE_NAME }
    )
  )
);
