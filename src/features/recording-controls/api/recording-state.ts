import { invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

export const startRecording = () => {
  void invoke(Commands.StartRecording);
};

export const stopRecording = () => {
  void invoke(Commands.StopRecording);
};
