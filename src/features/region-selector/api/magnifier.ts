import { Channel, invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

export const startMagnifierCapture = (
  channel: Channel,
  displayName: string
) => {
  void invoke(Commands.StartMagnifierCapture, { channel, displayName });
};

export const stopMagnifierCapture = () => {
  void invoke(Commands.StopMagnifierCapture);
};
