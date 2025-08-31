import { invoke } from "@tauri-apps/api/core";

import { commands } from "../../../types/api";

export const openPathInFileBrowser = (path: string) => {
  void invoke(commands.OPEN_PATH_IN_FILE_BROWSER, { path });
};

export const pathExists = async (path: string): Promise<boolean> =>
  await invoke(commands.PATH_EXISTS, { path });

type ExportRecordingOptions = {
  destinationFilePath: string;
  openFolderAfterExport: boolean;
  separateAudioTracks: boolean;
  separateCameraFile: boolean;
  sourceFolderPath: string;
};
export const exportRecording = (options: ExportRecordingOptions) => {
  void invoke(commands.EXPORT_RECORDING, { options });
};

export const cancelExport = () => {
  void invoke(commands.CANCEL_EXPORT);
};
