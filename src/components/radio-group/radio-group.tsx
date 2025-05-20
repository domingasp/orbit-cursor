import {
  RadioGroup as AriaRadioGroup,
  RadioGroupProps as AriaRadioGroupProps,
  composeRenderProps,
} from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../tailwind-merge.config";

const radioGroupVariants = tv({
  base: "flex gap-2",
  variants: {
    orientation: {
      horizontal: "flex-row",
      vertical: "flex-col",
    },
  },
});

type RadioGroupProps = AriaRadioGroupProps &
  VariantProps<typeof radioGroupVariants>;

const RadioGroup = ({ className, ...props }: RadioGroupProps) => {
  return (
    <AriaRadioGroup
      {...props}
      className={composeRenderProps(className, (className, renderProps) =>
        radioGroupVariants({ className, orientation: renderProps.orientation })
      )}
    />
  );
};

export default RadioGroup;
