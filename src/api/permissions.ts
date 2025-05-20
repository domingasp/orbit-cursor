import { invoke } from "@tauri-apps/api/core";

import {
  PermissionsSchema,
  PermissionType,
  Permissions,
} from "../stores/permissions.store";
import { Commands } from "../types/api";

export const requestPermissions = (type: PermissionType) => {
  void invoke(Commands.RequestPermission, { permission: type });
};

export const checkPermissions = async (): Promise<Permissions> => {
  const permissions = await invoke(Commands.CheckPermissions);
  return PermissionsSchema.parse(permissions);
};

export const openSystemSettings = () => {
  void invoke(Commands.OpenSystemSettings);
};

export const quitApp = () => {
  void invoke(Commands.QuitApp);
};
