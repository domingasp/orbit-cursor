import { invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

export const openPathInFileBrowser = (path: string) => {
  void invoke(Commands.OpenPathInFileBrowser, { path });
};

export const pathExists = async (path: string): Promise<boolean> =>
  await invoke(Commands.PathExists, { path });

type ExportRecordingOptions = {
  destinationFilePath: string;
  openFolderAfterExport: boolean;
  separateAudioTracks: boolean;
  separateCameraFile: boolean;
  sourceFolderPath: string;
};
export const exportRecording = (options: ExportRecordingOptions) => {
  void invoke(Commands.ExportRecording, { options });
};
