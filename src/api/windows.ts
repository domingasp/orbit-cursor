import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

import { Commands } from "../types/api";

export const initStandaloneListBox = () => {
  void invoke(Commands.InitStandaloneListBox);
};

export const initRecordingInputOptions = () => {
  void invoke(Commands.InitRecordingInputOptions);
};

export const InitRecordingSourceSelector = () => {
  void invoke(Commands.InitRecordingSourceSelector);
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

export const expandRecordingSourceSelector = () => {
  void invoke(Commands.ExpandRecordingSourceSelector);
};

export const collapseRecordingSourceSelector = () => {
  void invoke(Commands.CollapseRecordingSourceSelector);
};
