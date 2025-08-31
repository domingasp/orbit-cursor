import { invoke } from "@tauri-apps/api/core";
import {
  LogicalPosition,
  LogicalSize,
  PhysicalSize,
} from "@tauri-apps/api/dpi";

import { commands } from "../../../types/api";

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
  pid: number;
  position: LogicalPosition;
  scaleFactor: number;
  size: LogicalSize;
  thumbnailPath: string | null;
  title: string;
};

export const listMonitors = async () => {
  const monitors = await invoke(commands.LIST_MONITORS);
  return monitors as MonitorDetails[];
};

export const listWindows = (generateThumbnails: boolean) => {
  void invoke(commands.LIST_WINDOWS, { generateThumbnails });
};

export const resizeWindow = (
  pid: number,
  title: string,
  size: PhysicalSize
) => {
  void invoke(commands.RESIZE_WINDOW, { pid, size, title });
};

export const makeBorderless = (pid: number, title: string) => {
  void invoke(commands.MAKE_BORDERLESS, { pid, title });
};

export const restoreBorder = (pid: number, title: string) => {
  void invoke(commands.RESTORE_BORDER, { pid, title });
};

export const centerWindow = (pid: number, title: string) => {
  void invoke(commands.CENTER_WINDOW, { pid, title });
};
