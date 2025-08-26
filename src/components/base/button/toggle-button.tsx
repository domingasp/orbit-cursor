import { AnimatePresence, motion, MotionProps } from "motion/react";
import { AriaToggleButtonProps } from "react-aria";
import { ToggleButton as AriaToggleButton } from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";
import {
  availableVariants,
  elementFocusVisible,
  focusStyles,
} from "../../../lib/styling";

const toggleButtonVariants = tv({
  base: [
    "relative flex justify-center items-center text-muted outline-none transition-colors",
    "data-[selected]:text-content-fg",
  ],
  compoundVariants: [
    {
      class: "px-3 py-2",
      size: "md",
      variant: "solid",
    },
    {
      class: "px-2 py-1",
      size: "sm",
      variant: "solid",
    },
    {
      class: elementFocusVisible,
      showFocus: true,
      variant: "solid",
    },
  ],
  defaultVariants: { showFocus: true, size: "md", variant: "solid" },
  variants: {
    showFocus: availableVariants("true"),
    size: { md: "text-md", sm: "text-xs" },
    variant: {
      ghost:
        "p-1 transition-transform transform data-[hovered]:scale-110 data-[pressed]:scale-105",
      solid: [
        "border-1 border-muted/30 rounded-md",
        "data-[hovered]:bg-neutral/50 data-[pressed]:bg-neutral/80 data-[selected]:bg-neutral",
        focusStyles,
      ],
    },
  },
});

type ToggleButtonProps = AriaToggleButtonProps &
  VariantProps<typeof toggleButtonVariants> & {
    children: React.ReactNode;
    className?: string;
    off?: React.ReactNode;
  };

export const ToggleButton = ({
  children,
  className,
  off,
  size,
  variant = "solid",
  ...props
}: ToggleButtonProps) => {
  const animationProps: MotionProps = {
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0 },
    initial: { opacity: 0, scale: 0 },
  };

  return (
    <AriaToggleButton
      {...props}
      className={toggleButtonVariants({ className, size, variant })}
    >
      {({ isSelected }) => (
        <>
          {variant === "solid" && (isSelected ? children : off ?? children)}

          {variant === "ghost" && (
            <>
              <div className="invisible">{children}</div>

              <AnimatePresence>
                {isSelected ? (
                  <motion.div
                    key="selected"
                    {...animationProps}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    {children}
                  </motion.div>
                ) : (
                  <motion.div
                    key="deselected"
                    {...animationProps}
                    className="absolute inset-0 flex items-center justify-center text-muted"
                  >
                    {off ?? children}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </>
      )}
    </AriaToggleButton>
  );
};
