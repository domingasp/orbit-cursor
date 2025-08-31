import { invoke } from "@tauri-apps/api/core";

import {
  PermissionsSchema,
  PermissionType,
  Permissions,
} from "../stores/permissions.store";
import { commands } from "../types/api";

export const requestPermissions = (type: PermissionType) => {
  void invoke(commands.REQUEST_PERMISSION, { permission: type });
};

export const checkPermissions = async (): Promise<Permissions> => {
  const permissions = await invoke(commands.CHECK_PERMISSIONS);
  return PermissionsSchema.parse(permissions);
};

export const openSystemSettings = () => {
  void invoke(commands.OPEN_SYSTEM_SETTINGS);
};

export const quitApp = () => {
  void invoke(commands.QUIT_APP);
};
