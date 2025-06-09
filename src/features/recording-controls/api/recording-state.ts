import { invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

type StartRecordingProps = {
  cameraName: string | undefined;
  inputAudioName: string | undefined;
  systemAudio: boolean;
};
export const startRecording = (options: StartRecordingProps) => {
  void invoke(Commands.StartRecording, { options });
};

export const stopRecording = () => {
  void invoke(Commands.StopRecording);
};
