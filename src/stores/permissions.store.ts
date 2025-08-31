import { dequal } from "dequal";
import { z } from "zod";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { getPlatform } from "./hotkeys.store";

export const permissionType = {
  ACCESSIBILITY: "accessibility",
  CAMERA: "camera",
  MICROPHONE: "microphone",
  SCREEN: "screen",
} as const;

export type PermissionType =
  (typeof permissionType)[keyof typeof permissionType];

const PermissionStatusSchema = z.object({
  canRequest: z.boolean(),
  hasAccess: z.boolean(),
});

export const PermissionsSchema = z.record(
  z.enum(permissionType),
  PermissionStatusSchema
);

export type PermissionStatus = z.infer<typeof PermissionStatusSchema>;
export type Permissions = z.infer<typeof PermissionsSchema>;

type PermissionsState = {
  canUnlock: boolean;
  hasRequired: () => boolean;
  permissions: Permissions;
  setCanUnlock: (permissions: Permissions) => void;
  setPermissions: (permissions: Permissions) => void;
};

export const usePermissionsStore = create<PermissionsState>()(
  devtools(
    (set, get) => ({
      // Only `MacOS` has permissions
      canUnlock: getPlatform() !== "macos",
      hasRequired: () =>
        getPlatform() === "windows"
          ? true
          : get().permissions.screen.hasAccess &&
            get().permissions.accessibility.hasAccess,
      permissions: {
        [permissionType.ACCESSIBILITY]: {
          canRequest: true,
          hasAccess: getPlatform() !== "macos",
        },
        [permissionType.SCREEN]: {
          canRequest: true,
          hasAccess: getPlatform() !== "macos",
        },
        [permissionType.MICROPHONE]: {
          canRequest: true,
          hasAccess: getPlatform() !== "macos",
        },
        [permissionType.CAMERA]: {
          canRequest: true,
          hasAccess: getPlatform() !== "macos",
        },
      } satisfies Permissions,
      setCanUnlock: (permissions) => {
        set({
          canUnlock:
            permissions.accessibility.hasAccess && permissions.screen.hasAccess,
        });
      },
      setPermissions: (permissions) => {
        const currentPermissions = get().permissions;
        if (dequal(currentPermissions, permissions)) return;
        set({ permissions });
      },
    }),
    { name: "permissionsStore" }
  )
);
