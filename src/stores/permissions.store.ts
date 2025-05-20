import { dequal } from "dequal";
import { z } from "zod";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

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
  z.nativeEnum(PermissionType),
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
      canUnlock: false,
      permissions: {},
      setCanUnlock: (permissions) => {
        set({
          canUnlock:
            permissions.accessibility?.hasAccess &&
            permissions.screen?.hasAccess,
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
