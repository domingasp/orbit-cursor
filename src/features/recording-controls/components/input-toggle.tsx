import { CircleOff, Lock, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { ToggleButton } from "../../../components/base/button/toggle-button";
import { cn } from "../../../lib/styling";
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
          (warning === WarningType.NoPermission ||
            (warning === WarningType.Empty && value) ||
            warning === WarningType.Disconnected) && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              initial={{ opacity: 0, y: -5 }}
              className={cn(
                "absolute -top-3",
                warning === WarningType.NoPermission
                  ? "text-muted"
                  : "text-warning"
              )}
            >
              {warning === WarningType.NoPermission && <Lock size={12} />}
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
        variant="ghost"
        onChange={() => {
          onToggle();
        }}
      >
        {onIcon}
      </ToggleButton>
    </div>
  );
};
