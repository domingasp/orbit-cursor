import { invoke } from "@tauri-apps/api/core";
import {
  LogicalPosition,
  LogicalSize,
  PhysicalSize,
} from "@tauri-apps/api/dpi";

import { Commands } from "../../../types/api";

export type MonitorDetails = {
  id: string;
  name: string;
  physicalSize: PhysicalSize;
  position: LogicalPosition;
  scaleFactor: number;
  size: LogicalSize;
};

export type WindowDetails = {
  appIconPath: string | null;
  id: number;
  scaleFactor: number;
  size: LogicalSize;
  thumbnailPath: string | null;
  title: string;
};

export const listMonitors = async () => {
  const monitors = await invoke(Commands.ListMonitors);
  return monitors as MonitorDetails[];
};

export const listWindows = async (generateThumbnails: boolean) => {
  const windows = await invoke(Commands.ListWindows, { generateThumbnails });
  return windows as WindowDetails[];
};
