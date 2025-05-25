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
      "group relative flex flex-col grow items-center p-2 rounded-md transition select-none",
      focusStyles,
      elementFocus,
    ],
    icon: [
      "text-muted transition-colors",
      "group-data-[hovered]:text-content-fg/75",
      "group-data-[selected]:text-content-fg",
    ],
    subtext: [
      "text-[10px] font-semibold text-muted transition-colors",
      "group-data-[selected]:text-content-fg",
    ],
  },
});

type IconRadioProps = AriaRadioProps &
  VariantProps<typeof radioVariants> & {
    icon: React.ReactNode;
    subtext: string;
    shortcut?: React.ReactNode;
  };

const IconRadio = ({ icon, shortcut, subtext, ...props }: IconRadioProps) => {
  const { base, icon: _icon, subtext: _subtext } = radioVariants();

  return (
    <AriaRadio {...props} className={base()}>
      <div className={_icon()}>{icon}</div>
      <div className={_subtext()}>{subtext}</div>
      {shortcut}
    </AriaRadio>
  );
};

export default IconRadio;
