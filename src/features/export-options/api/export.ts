import { invoke } from "@tauri-apps/api/core";

import { Commands } from "../../../types/api";

export const pathExists = async (path: string): Promise<boolean> =>
  await invoke(Commands.PathExists, { path });
