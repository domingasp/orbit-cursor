import { Channel, invoke } from "@tauri-apps/api/core";

import { commands } from "../../../types/api";

export const audioStream = {
  MICROPHONE: "microphone",
  SYSTEM: "system",
} as const;

export type AudioStream = (typeof audioStream)[keyof typeof audioStream];

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
  void invoke(commands.START_AUDIO_LISTENER, {
    deviceName,
    onEvent,
    streamToStart,
  });
};

export const stopAudioListener = async (streamName: AudioStream) => {
  await invoke(commands.STOP_AUDIO_LISTENER, { streamName });
};

export const listAudioInputs = async (): Promise<string[]> =>
  await invoke(commands.LIST_AUDIO_INPUTS);
