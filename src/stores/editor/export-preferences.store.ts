import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

const STORE_NAME = "exportPreferences";

type ExportPreferencesState = {
  defaultExportDirectory: string | null;
  openFolderAfterExport: boolean;
  separateAudioTracks: boolean;
  separateCameraFile: boolean;
  setDefaultExportDirectory: (defaultExportDirectory: string | null) => void;
  setOpenFolderAfterExport: (openFolderAfterExport: boolean) => void;
  setSeparateAudioTracks: (separateAudioTracks: boolean) => void;
  setSeparateCameraFile: (separateCameraFile: boolean) => void;
};

export const useExportPreferencesStore = create<ExportPreferencesState>()(
  devtools(
    persist(
      (set) => ({
        defaultExportDirectory: null,
        openFolderAfterExport: true,
        separateAudioTracks: false,
        separateCameraFile: false,
        setDefaultExportDirectory: (defaultExportDirectory) => {
          set({ defaultExportDirectory });
        },
        setOpenFolderAfterExport: (openFolderAfterExport) => {
          set({ openFolderAfterExport });
        },
        setSeparateAudioTracks: (separateAudioTracks) => {
          set({ separateAudioTracks });
        },
        setSeparateCameraFile: (separateCameraFile) => {
          set({ separateCameraFile });
        },
      }),
      { name: STORE_NAME }
    )
  )
);
