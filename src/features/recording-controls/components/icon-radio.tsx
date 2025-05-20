import { motion } from "motion/react";
import {
  Radio as AriaRadio,
  RadioProps as AriaRadioProps,
} from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";
import { elementFocus, focusStyles } from "../../../lib/styling";

const radioVariants = tv({
  slots: {
    base: [
      "relative flex flex-col grow items-center p-2 rounded-md transition select-none",
      "data-[hovered]:bg-neutral/25",
      focusStyles,
      elementFocus,
    ],
    bubble: "absolute inset-0 bg-neutral rounded-sm -z-1",
    icon: "text-content-fg",
    subtext: "text-[10px] font-semibold text-muted",
  },
});

type IconRadioProps = AriaRadioProps &
  VariantProps<typeof radioVariants> & {
    icon: React.ReactNode;
    subtext: string;
    shortcut?: React.ReactNode;
  };

const IconRadio = ({ icon, shortcut, subtext, ...props }: IconRadioProps) => {
  const { base, bubble, icon: _icon, subtext: _subtext } = radioVariants();

  return (
    <AriaRadio {...props} className={base()}>
      {({ isSelected }) => (
        <>
          {isSelected && (
            <motion.span
              className={bubble()}
              layoutId="bubble"
              transition={{ bounce: 0.2, duration: 0.6, type: "spring" }}
            />
          )}
          <div className={_icon()}>{icon}</div>
          <div className={_subtext()}>{subtext}</div>
          {shortcut}
        </>
      )}
    </AriaRadio>
  );
};

export default IconRadio;
