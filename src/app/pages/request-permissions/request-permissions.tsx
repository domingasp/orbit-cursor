import { Disc, Mic, PersonStanding, Video } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
  quitApp,
  requestPermissions,
} from "../../../api/permissions";
import Button from "../../../components/button/button";
import PermissionRow from "../../../features/permissions/components/permission-row";
import Gradients from "../../../features/permissions/types/gradients";
import {
  PermissionType,
  usePermissionsStore,
} from "../../../stores/permissions.store";

const ICON_SIZE = 40;

const RequestPermissions = () => {
  const permissions = usePermissionsStore((state) => state.permissions);

  return (
    <div className="p-8">
      <div className="mb-5 flex flex-row justify-between items-center">
        <p className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-500 text-transparent bg-clip-text animate-gradient bg-size-[300%]">
          Permissions
        </p>

        <AnimatePresence>
          {permissions.accessibility?.hasAccess &&
            permissions.screen?.hasAccess && (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="text-content-fg"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0, scale: 0 }}
              >
                <Button color="info" onClick={quitApp} size="sm" variant="soft">
                  Quit & Reopen
                </Button>
              </motion.div>
            )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-4">
        <PermissionRow
          color={Gradients.Blue}
          description="For capturing cursor events."
          icon={<PersonStanding size={ICON_SIZE} />}
          status={permissions.accessibility}
          title="Accessibility"
          onClick={() => {
            requestPermissions(PermissionType.Accessibility);
          }}
        />
        <PermissionRow
          color={Gradients.Red}
          icon={<Disc size={ICON_SIZE} />}
          status={permissions.screen}
          title="Screen Recording"
          onClick={() => {
            requestPermissions(PermissionType.Screen);
          }}
        />
        <PermissionRow
          color={Gradients.Gray}
          icon={<Video size={ICON_SIZE} />}
          status={permissions.camera}
          title="Camera"
          onClick={() => {
            requestPermissions(PermissionType.Camera);
          }}
        />
        <PermissionRow
          color={Gradients.Gray}
          icon={<Mic size={ICON_SIZE} />}
          status={permissions.microphone}
          title="Microphone"
          onClick={() => {
            requestPermissions(PermissionType.Microphone);
          }}
        />
      </div>
    </div>
  );
};

export default RequestPermissions;
