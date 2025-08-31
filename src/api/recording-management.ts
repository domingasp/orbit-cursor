import { invoke } from "@tauri-apps/api/core";

import { commands } from "../types/api";

export type RecordingDetails = {
  camera: string | null;
  id: number;
  microphone: string | null;
  name: string;
  screen: string;
  systemAudio: string | null;
};

export const getRecordingDetails = async (
  recordingId: number
): Promise<RecordingDetails> =>
  invoke("get_recording_details", { recordingId });

export const recordingOpened = (recordingId: number) => {
  void invoke(commands.RECORDING_OPENED, { recordingId });
};
