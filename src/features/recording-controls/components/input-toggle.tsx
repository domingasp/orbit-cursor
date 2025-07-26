import { CircleOff, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { ToggleButton } from "../../../components/button/toggle-button";
import { PermissionStatus } from "../../../stores/permissions.store";

import { WarningType } from "./input-toggle-groups";

type InputToggleProps = {
  offIcon: React.ReactNode;
  onIcon: React.ReactNode;
  openRecordingInputOptions: () => Promise<void>;
  permission: PermissionStatus;
  setValue: (value: boolean) => void;
  value: boolean;
  warning?: WarningType;
};

export const InputToggle = ({
  offIcon,
  onIcon,
  openRecordingInputOptions,
  permission,
  setValue,
  value,
  warning,
}: InputToggleProps) => {
  const onToggle = () => {
    if (permission.hasAccess && warning !== WarningType.Disconnected)
      setValue(!value);
    else void openRecordingInputOptions();
  };

  return (
    <div className="relative flex justify-center">
      <AnimatePresence>
        {warning &&
          ((warning === WarningType.Empty && value) ||
            warning === WarningType.Disconnected) && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="absolute text-warning -top-3"
              exit={{ opacity: 0, y: -5 }}
              initial={{ opacity: 0, y: -5 }}
            >
              {warning === WarningType.Disconnected && (
                <TriangleAlert size={12} />
              )}
              {warning === WarningType.Empty && <CircleOff size={12} />}
            </motion.div>
          )}
      </AnimatePresence>

      <ToggleButton
        isSelected={value}
        off={offIcon}
        on={onIcon}
        onChange={() => {
          onToggle();
        }}
      />
    </div>
  );
};
