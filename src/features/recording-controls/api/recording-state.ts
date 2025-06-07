import { invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

export const startRecording = (systemAudio: boolean) => {
  void invoke(Commands.StartRecording, { systemAudio });
};

export const stopRecording = () => {
  void invoke(Commands.StopRecording);
};
