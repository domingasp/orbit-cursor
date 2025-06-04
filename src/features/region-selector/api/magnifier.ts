import { Channel, invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

export const initMagnifierCapturer = (displayName: string) => {
  void invoke(Commands.InitMagnifierCapturer, { displayName });
};

export const startMagnifierCapture = (channel: Channel) => {
  void invoke(Commands.StartMagnifierCapture, { channel });
};

export const stopMagnifierCapture = () => {
  void invoke(Commands.StopMagnifierCapture);
};
