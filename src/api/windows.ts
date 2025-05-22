import { invoke } from "@tauri-apps/api/core";

import { Commands } from "../types/api";

export const initStandaloneListBox = () => {
  void invoke(Commands.InitStandaloneListBox);
};

export const hideStartRecordingDock = () => {
  void invoke(Commands.HideStartRecordingDock);
};

type ShowStandaloneListBoxProps = { width: number; x: number; y: number };
export const showStandaloneListBox = async ({
  width,
  x,
  y,
}: ShowStandaloneListBoxProps) => {
  await invoke(Commands.ShowStandaloneListBox, {
    height: 100,
    width,
    x,
    y,
  });
};

export const isStartRecordingDockOpen = async (): Promise<boolean> => {
  return await invoke(Commands.IsStartRecordingDockOpen);
};
