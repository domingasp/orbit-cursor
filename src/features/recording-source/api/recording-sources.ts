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
  pid: number;
  position: LogicalPosition;
  scaleFactor: number;
  size: LogicalSize;
  thumbnailPath: string | null;
  title: string;
};

export const listMonitors = async () => {
  const monitors = await invoke(Commands.ListMonitors);
  return monitors as MonitorDetails[];
};

export const listWindows = (generateThumbnails: boolean) => {
  void invoke(Commands.ListWindows, { generateThumbnails });
};

export const resizeWindow = (
  pid: number,
  title: string,
  size: PhysicalSize
) => {
  void invoke(Commands.ResizeWindow, { pid, size, title });
};

export const makeBorderless = (pid: number, title: string) => {
  void invoke(Commands.MakeBorderless, { pid, title });
};

export const restoreBorder = (pid: number, title: string) => {
  void invoke(Commands.RestoreBorder, { pid, title });
};

export const centerWindow = (pid: number, title: string) => {
  void invoke(Commands.CenterWindow, { pid, title });
};
