import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

import { Commands } from "../types/api";

export const initStandaloneListBox = () => {
  void invoke(Commands.InitStandaloneListBox);
};

export const initRecordingInputOptions = () => {
  void invoke(Commands.InitRecordingInputOptions);
};

export const initRecordingSourceSelector = () => {
  void invoke(Commands.InitRecordingSourceSelector);
};

export const initRegionSelector = () => {
  void invoke(Commands.InitRegionSelector);
};

export const initRecordingDock = () => {
  void invoke(Commands.InitRecordingDock);
};

export const hideStartRecordingDock = () => {
  void invoke(Commands.HideStartRecordingDock);
};

export const showStandaloneListBox = async (
  parentWindowLabel: string,
  offset: LogicalPosition,
  size: LogicalSize
) => {
  await invoke(Commands.ShowStandaloneListBox, {
    offset,
    parentWindowLabel,
    size,
  });
};

export const isStartRecordingDockOpen = async (): Promise<boolean> => {
  return await invoke(Commands.IsStartRecordingDockOpen);
};

/** `x` coordinate is the logical coordinate. */
export const showRecordingInputOptions = (x: number) => {
  void invoke(Commands.ShowRecordingInputOptions, { x });
};

export const isRecordingInputOptionsOpen = async (): Promise<boolean> => {
  return await invoke(Commands.IsRecordingInputOptionsOpen);
};

export const expandRecordingSourceSelector = (size?: LogicalSize) => {
  void invoke(Commands.ExpandRecordingSourceSelector, { size });
};

export const collapseRecordingSourceSelector = () => {
  void invoke(Commands.CollapseRecordingSourceSelector);
};

export const showRegionSelector = (
  position: LogicalPosition,
  size: LogicalSize
) => {
  void invoke(Commands.ShowRegionSelector, { position, size });
};

export const hideRegionSelector = () => {
  void invoke(Commands.HideRegionSelector);
};

export const resetPanels = () => {
  void invoke(Commands.ResetPanels);
};

export const getDockBounds = async (): Promise<{
  displayId: string | undefined;
  endPoint: LogicalPosition;
  startPoint: LogicalPosition;
}> => await invoke(Commands.GetDockBounds);

export const updateDockOpacity = (opacity: number) => {
  void invoke(Commands.UpdateDockOpacity, { opacity });
};
