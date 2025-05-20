import { X } from "lucide-react";
import { motion, MotionProps } from "motion/react";
import { useContext } from "react";
import {
  Button as AriaButton,
  SelectStateContext,
} from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";
import { elementFocus, focusStyles } from "../../../lib/styling";

const clearButtonVariants = tv({
  slots: {
    base: "flex items-center absolute inset-y-0 flex right-7",
    button: [
      "transition-colors rounded-sm p-0.5 mb-0.5 flex",
      "data-[hovered]:bg-error/10 data-[hovered]:text-error",
      "data-[pressed]:bg-error/5",
      focusStyles,
      elementFocus,
    ],
  },
});

// TASK rework main button component
const MotionAriaButton = motion.create(AriaButton);

type ClearButtonProps = MotionProps &
  VariantProps<typeof clearButtonVariants> & {
    className?: string;
    onClear?: () => void;
    size?: number;
  };
const ClearButton = ({
  className,
  onClear,
  size = 14,
  ...props
}: ClearButtonProps) => {
  const { base, button } = clearButtonVariants({ className });
  const state = useContext(SelectStateContext);
  return (
    <div className={base()}>
      <MotionAriaButton
        {...props}
        aria-label="Clear selection"
        className={button({ className })}
        slot={null}
        onPress={() => {
          state?.setSelectedKey(null);
          if (onClear) onClear();
        }}
      >
        <X size={size} />
      </MotionAriaButton>
    </div>
  );
};

export default ClearButton;
