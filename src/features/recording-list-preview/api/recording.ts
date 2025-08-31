import { invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

export const softDeleteRecordings = async (
  recordingIds: number[]
): Promise<Date> => {
  const response = await invoke(Commands.SoftDeleteRecordings, {
    recordingIds,
  });

  return new Date((response as { deletedAt: string }).deletedAt);
};

export const hardDeleteRecordings = (recordingIds: number[]) =>
  invoke(Commands.HardDeleteRecordings, {
    recordingIds,
  });

export const restoreRecordings = (recordingIds: number[]) =>
  invoke(Commands.RestoreRecordings, {
    recordingIds,
  });
