import { AnimatePresence, motion, MotionProps } from "motion/react";
import { AriaToggleButtonProps } from "react-aria";
import { ToggleButton as AriaToggleButton } from "react-aria-components";

import { tv } from "../../../tailwind-merge.config";

const toggleButtonVariants = tv({
  slots: {
    base: [
      "relative flex justify-center items-center text-content-fg p-1 outline-none",
      "transition-transform transform data-[hovered]:scale-110 data-[pressed]:scale-105",
    ],
    state: "absolute inset-0 flex items-center justify-center",
  },
  variants: {
    off: {
      true: {
        state: "text-muted",
      },
    },
  },
});

type ToggleButtonProps = AriaToggleButtonProps & {
  off: React.ReactNode;
  on: React.ReactNode;
  className?: string;
};

export const ToggleButton = ({
  className,
  off,
  on,
  ...props
}: ToggleButtonProps) => {
  const { base, state } = toggleButtonVariants();

  const animationProps: MotionProps = {
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0 },
    initial: { opacity: 0, scale: 0 },
  };

  return (
    <AriaToggleButton {...props} className={base({ className })}>
      {({ isSelected }) => (
        <>
          <div className="invisible">{off}</div>

          <AnimatePresence>
            {isSelected ? (
              <motion.div
                key="selected"
                {...animationProps}
                className={state()}
              >
                {on}
              </motion.div>
            ) : (
              <motion.div
                key="deselected"
                {...animationProps}
                className={state({ off: true })}
              >
                {off}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AriaToggleButton>
  );
};
