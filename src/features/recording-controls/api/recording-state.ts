import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

import { RecordingType } from "../../../stores/recording-state.store";
import { commands } from "../../../types/api";

type StartRecordingProps = {
  cameraName: string | undefined;
  microphoneName: string | undefined;
  monitorName: string;
  recordingType: RecordingType;
  region: { position: LogicalPosition; size: LogicalSize };
  showSystemCursor: boolean;
  systemAudio: boolean;
  windowId: number | undefined;
};
export const startRecording = (options: StartRecordingProps) => {
  void invoke(commands.START_RECORDING, { options });
};
