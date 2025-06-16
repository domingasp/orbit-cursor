import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

import { RecordingType } from "../../../stores/recording-state.store";
import { Commands } from "../../../types/api";

type StartRecordingProps = {
  cameraName: string | undefined;
  inputAudioName: string | undefined;
  monitorName: string;
  recordingType: RecordingType;
  region: { position: LogicalPosition; size: LogicalSize };
  systemAudio: boolean;
  windowId: number | undefined;
};
export const startRecording = (options: StartRecordingProps) => {
  void invoke(Commands.StartRecording, { options });
};

export const stopRecording = () => {
  void invoke(Commands.StopRecording);
};
