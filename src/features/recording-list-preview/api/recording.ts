import { invoke } from "@tauri-apps/api/core";

import { commands } from "../../../types/api";

export const softDeleteRecordings = async (
  recordingIds: number[]
): Promise<Date> => {
  const response = await invoke(commands.SOFT_DELETE_RECORDINGS, {
    recordingIds,
  });

  return new Date((response as { deletedAt: string }).deletedAt);
};

export const hardDeleteRecordings = (recordingIds: number[]) =>
  invoke(commands.HARD_DELETE_RECORDINGS, {
    recordingIds,
  });

export const restoreRecordings = (recordingIds: number[]) =>
  invoke(commands.RESTORE_RECORDINGS, {
    recordingIds,
  });
