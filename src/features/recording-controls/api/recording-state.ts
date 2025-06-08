import { invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

type StartRecordingProps = {
  cameraName: string | undefined;
  deviceName: string | undefined;
  systemAudio: boolean;
};
export const startRecording = (recordingOptions: StartRecordingProps) => {
  void invoke(Commands.StartRecording, recordingOptions);
};

export const stopRecording = () => {
  void invoke(Commands.StopRecording);
};
