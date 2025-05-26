import { AnimatePresence, motion, MotionProps } from "motion/react";
import { useState } from "react";

import Button from "../../../components/button/button";
import { PermissionStatus } from "../../../stores/permissions.store";

type InputToggleProps = {
  offIcon: React.ReactNode;
  onIcon: React.ReactNode;
  permission: PermissionStatus;
  showRecordingInputOptions: () => void;
};
const InputToggle = ({
  offIcon,
  onIcon,
  permission,
  showRecordingInputOptions,
}: InputToggleProps) => {
  const [isOn, setIsOn] = useState(false);

  const animationProps: MotionProps = {
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0 },
    initial: { opacity: 0, scale: 0 },
  };

  const onToggle = () => {
    if (permission.hasAccess) setIsOn((prev) => !prev);
    else showRecordingInputOptions();
  };

  return (
    <Button
      className="cursor-default relative p-1 transition-transform transform data-[hovered]:scale-110"
      onPress={onToggle}
      showFocus={false}
      variant="ghost"
    >
      <div className="invisible">{onIcon}</div>

      <AnimatePresence>
        {isOn ? (
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

export default InputToggle;
