import { Channel, invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

export const listCameras = async (): Promise<string[]> =>
  await invoke(Commands.ListCameras);

export const startCameraStream = (name: string, channel: Channel) => {
  void invoke(Commands.StartCameraStream, { channel, name });
};

export const stopCameraStream = async () => {
  await invoke(Commands.StopCameraStream);
};
