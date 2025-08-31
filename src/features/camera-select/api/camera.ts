import { Channel, invoke } from "@tauri-apps/api/core";

import { commands } from "../../../types/api";

export const listCameras = async (): Promise<string[]> =>
  await invoke(commands.LIST_CAMERAS);

export const startCameraStream = (name: string, channel: Channel) => {
  void invoke(commands.START_CAMERA_STREAM, { channel, name });
};

export const stopCameraStream = async () => {
  await invoke(commands.STOP_CAMERA_STREAM);
};
