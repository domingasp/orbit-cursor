import { dequal } from "dequal";
import { z } from "zod";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { getPlatform } from "./hotkeys.store";

export enum PermissionType {
  Accessibility = "accessibility",
  Screen = "screen",
  Microphone = "microphone",
  Camera = "camera",
}

const PermissionStatusSchema = z.object({
  canRequest: z.boolean(),
  hasAccess: z.boolean(),
});

export const PermissionsSchema = z.record(
  z.enum(PermissionType),
  PermissionStatusSchema
);

export type PermissionStatus = z.infer<typeof PermissionStatusSchema>;
export type Permissions = z.infer<typeof PermissionsSchema>;

type PermissionsState = {
  canUnlock: boolean;
  permissions: Permissions;
  setCanUnlock: (permissions: Permissions) => void;
  setPermissions: (permissions: Permissions) => void;
};

export const usePermissionsStore = create<PermissionsState>()(
  devtools(
    (set, get) => ({
      // Only `MacOS` has permissions
      canUnlock: getPlatform() !== "macos",
      permissions: {
        [PermissionType.Accessibility]: {
          canRequest: true,
          hasAccess: getPlatform() !== "macos",
        },
        [PermissionType.Screen]: {
          canRequest: true,
          hasAccess: getPlatform() !== "macos",
        },
        [PermissionType.Microphone]: {
          canRequest: true,
          hasAccess: getPlatform() !== "macos",
        },
        [PermissionType.Camera]: {
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
