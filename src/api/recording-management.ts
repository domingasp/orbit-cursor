import { invoke } from "@tauri-apps/api/core";

export type RecordingDetails = {
  camera: string | null;
  id: number;
  microphone: string | null;
  screen: string;
  systemAudio: string | null;
};

export const getRecordingDetails = async (
  recordingId: number
): Promise<RecordingDetails> =>
  invoke("get_recording_details", { recordingId });
