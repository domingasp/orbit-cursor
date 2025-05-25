import { Channel, invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import { Commands } from "../../../types/api";

const CameraDetailSchema = z.object({
  index: z.coerce.number(),
  name: z.string(),
});

const CameraDetailsSchema = z.array(CameraDetailSchema);

type CameraDetail = z.infer<typeof CameraDetailSchema>;

export const listCameras = async (): Promise<CameraDetail[]> => {
  const response = await invoke(Commands.ListCameras);
  return CameraDetailsSchema.parse(response);
};

export const startCameraStream = (deviceIndex: number, channel: Channel) => {
  void invoke(Commands.StartCameraStream, { channel, deviceIndex });
};

export const stopCameraStream = async () => {
  await invoke(Commands.StopCameraStream);
};
