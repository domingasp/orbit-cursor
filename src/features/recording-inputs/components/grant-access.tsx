import {
  openSystemSettings,
  requestPermissions,
} from "../../../api/permissions";
import Button from "../../../components/button/button";
import {
  PermissionStatus,
  PermissionType,
} from "../../../stores/permissions.store";

type GrantAccessProps = {
  permission: PermissionStatus | undefined;
  type: PermissionType;
  icon?: React.ReactNode;
};
const GrantAccess = ({ icon, permission, type }: GrantAccessProps) => {
  const onPressGrant = () => {
    if (permission?.canRequest) requestPermissions(type);
    else openSystemSettings();
  };

  return (
    <div className="flex w-full justify-center items-center bg-neutral/15 rounded-sm py-3">
      <Button onPress={onPressGrant} size="sm">
        {icon} {permission?.canRequest ? "Grant" : "System Settings"}
      </Button>
    </div>
  );
};

export default GrantAccess;
