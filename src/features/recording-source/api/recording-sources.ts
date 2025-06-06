import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

import { Commands } from "../../../types/api";

export type MonitorDetails = {
  id: string;
  name: string;
  position: LogicalPosition;
  size: LogicalSize;
};

export type WindowDetails = {
  appIconPath: string | null;
  id: number;
  thumbnailPath: string | null;
  title: string;
};

export const listMonitors = async () => {
  const monitors = await invoke(Commands.ListMonitors);
  return monitors as MonitorDetails[];
};

export const listWindows = async () => {
  const windows = await invoke(Commands.ListWindows);
  return windows as WindowDetails[];
};
