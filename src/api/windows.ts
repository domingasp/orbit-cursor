import { Channel, invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";

import { commands } from "../types/api";

export const initStandaloneListBox = () => {
  void invoke(commands.INIT_STANDALONE_LISTBOX);
};

export const initRecordingInputOptions = () => {
  void invoke(commands.INIT_RECORDING_INPUT_OPTIONS);
};

export const initRecordingSourceSelector = () => {
  void invoke(commands.INIT_RECORDING_SOURCE_SELECTOR);
};

export const initRegionSelector = () => {
  void invoke(commands.INIT_REGION_SELECTOR);
};

export const hideStartRecordingDock = () => {
  void invoke(commands.HIDE_START_RECORDING_DOCK);
};

export const setRegionSelectorPassthrough = (passthrough: boolean = false) => {
  void invoke(commands.SET_REGION_SELECTOR_PASSTHROUGH, {
    passthrough,
  });
};

export const setRegionSelectorOpacity = async (opacity: number) =>
  await invoke(commands.SET_REGION_SELECTOR_OPACITY, { opacity });

export const takeDisplayScreenshot = (
  displayId: string,
  channel: Channel<ArrayBuffer>
) => {
  void invoke(commands.TAKE_DISPLAY_SCREENSHOT, { channel, displayId });
};

export const showStandaloneListBox = async (
  parentWindowLabel: string,
  offset: LogicalPosition,
  size: LogicalSize
) => {
  await invoke(commands.SHOW_STANDALONE_LISTBOX, {
    offset,
    parentWindowLabel,
    size,
  });
};

export const isStartRecordingDockOpen = async (): Promise<boolean> => {
  return await invoke(commands.IS_START_RECORDING_DOCK_OPEN);
};

/** `x` coordinate is the logical coordinate. */
export const showRecordingInputOptions = (x: number) => {
  void invoke(commands.SHOW_RECORDING_INPUT_OPTIONS, { x });
};

export const isRecordingInputOptionsOpen = async (): Promise<boolean> => {
  return await invoke(commands.IS_RECORDING_INPUT_OPTIONS_OPEN);
};

export const expandRecordingSourceSelector = (size?: LogicalSize) => {
  void invoke(commands.EXPAND_RECORDING_SOURCE_SELECTOR, { size });
};

export const collapseRecordingSourceSelector = () => {
  void invoke(commands.COLLAPSE_RECORDING_SOURCE_SELECTOR);
};

export const showRegionSelector = (
  position: LogicalPosition,
  size: LogicalSize
) => {
  void invoke(commands.SHOW_REGION_SELECTOR, { position, size });
};

export const hideRegionSelector = () => {
  void invoke(commands.HIDE_REGION_SELECTOR);
};

export const resetPanels = () => {
  void invoke(commands.RESET_PANELS);
};

export const getDockBounds = async (): Promise<{
  displayId: string | undefined;
  endPoint: LogicalPosition;
  startPoint: LogicalPosition;
}> => await invoke(commands.GET_DOCK_BOUNDS);

export const updateDockOpacity = (opacity: number) => {
  void invoke(commands.UPDATE_DOCK_OPACITY, { opacity });
};
