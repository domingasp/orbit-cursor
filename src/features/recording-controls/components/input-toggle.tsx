import { CircleOff, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion, MotionProps } from "motion/react";

import { Button } from "../../../components/button/button";
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
  const animationProps: MotionProps = {
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0 },
    initial: { opacity: 0, scale: 0 },
  };

  const onToggle = () => {
    if (permission.hasAccess && warning !== WarningType.Disconnected)
      setValue(!value);
    else void openRecordingInputOptions();
  };

  return (
    <Button
      className="cursor-default relative p-1 transition-transform transform data-[hovered]:scale-110 justify-center"
      onPress={onToggle}
      showFocus={false}
      variant="ghost"
    >
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

      <div className="invisible">{onIcon}</div>

      <AnimatePresence>
        {value ? (
          <motion.div key="on" {...animationProps} className="absolute">
            {onIcon}
          </motion.div>
        ) : (
          <motion.div
            key="off"
            {...animationProps}
            className="absolute text-muted"
          >
            {offIcon}
          </motion.div>
        )}
      </AnimatePresence>
    </Button>
  );
};
