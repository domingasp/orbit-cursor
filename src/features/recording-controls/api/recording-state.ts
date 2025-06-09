import { invoke } from "@tauri-apps/api/core";

import { RecordingType } from "../../../stores/recording-state.store";
import { Commands } from "../../../types/api";

type StartRecordingProps = {
  cameraName: string | undefined;
  inputAudioName: string | undefined;
  monitorName: string;
  recordingType: RecordingType;
  systemAudio: boolean;
};
export const startRecording = (options: StartRecordingProps) => {
  void invoke(Commands.StartRecording, { options });
};

export const stopRecording = () => {
  void invoke(Commands.StopRecording);
};
