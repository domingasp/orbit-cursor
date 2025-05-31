import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

import { Commands } from "../../../types/api";

export type MonitorDetails = {
  id: string;
  name: string;
  position: LogicalPosition;
  size: LogicalSize;
};

export const listMonitors = async () => {
  const monitors = await invoke(Commands.ListMonitors);
  return monitors as MonitorDetails[];
};
