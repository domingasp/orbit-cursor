import {
  openSystemSettings,
  requestPermissions,
} from "../../../api/permissions";
import {
  PermissionStatus,
  PermissionType,
} from "../../../stores/permissions.store";
import { Button } from "../../base/button/button";
import { Overlay } from "../../base/overlay/overlay";

type GrantAccessProps = {
  permission: PermissionStatus | undefined;
  type: PermissionType;
  icon?: React.ReactNode;
};

export const GrantAccessOverlay = ({
  icon,
  permission,
  type,
}: GrantAccessProps) => {
  const onPressGrant = () => {
    if (permission?.canRequest) requestPermissions(type);
    else openSystemSettings();
  };

  return (
    <Overlay
      blur="md"
      className="-inset-1 rounded-md bg-content/66"
      isOpen={!permission?.hasAccess}
      contained
    >
      <Button onPress={onPressGrant} size="sm">
        {icon} {permission?.canRequest ? "Grant" : "System Settings"}
      </Button>
    </Overlay>
  );
};
