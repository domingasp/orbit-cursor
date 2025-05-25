import { Channel, invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

export enum AudioStream {
  System = "system",
  Input = "input",
}

export type AudioStreamChannel = {
  data: {
    decibels: number;
  };
  event: "signal";
};

export const startAudioListener = (
  streamToStart: AudioStream,
  onEvent: Channel<AudioStreamChannel>,
  deviceName?: string
) => {
  void invoke(Commands.StartAudioListener, {
    deviceName,
    onEvent,
    streamToStart,
  });
};

export const stopAudioListener = async (streamName: AudioStream) => {
  await invoke(Commands.StopAudioListener, { streamName });
};

export const listAudioInputs = async (): Promise<string[]> =>
  await invoke(Commands.ListAudioInputs);
