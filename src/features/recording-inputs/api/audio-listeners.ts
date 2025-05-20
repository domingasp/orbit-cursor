import { Channel, invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

export enum AudioStream {
  System = "system",
}

export type AudioStreamChannel = {
  data: {
    decibels: number;
  };
  event: "signal";
};

export const startAudioListener = (
  streamName: AudioStream,
  onEvent: Channel<AudioStreamChannel>
) => {
  void invoke(Commands.StartAudioListener, { onEvent, streamName });
};

export const stopAudioListener = (streamName: AudioStream) => {
  void invoke(Commands.StopAudioListener, { streamName });
};

export const stopAllAudioListeners = () => {
  void invoke(Commands.StopAllAudioListeners);
};
