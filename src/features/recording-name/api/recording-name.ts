import { invoke } from "@tauri-apps/api/core";

export const updateRecordingName = async (
  recordingId: number,
  newName: string
): Promise<void> => invoke("update_recording_name", { newName, recordingId });
