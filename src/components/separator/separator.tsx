import { SeparatorProps as AriaSeparatorProps, useSeparator } from "react-aria";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../tailwind-merge.config";
import { availableVariants } from "../../lib/styling";

const separatorVariants = tv({
  base: "bg-neutral-100 rounded-xs m-auto",
  compoundVariants: [
    {
      class: "my-1",
      orientation: "horizontal",
      spacing: "sm",
    },
    {
      class: "my-2",
      orientation: "horizontal",
      spacing: "md",
    },
    { class: "mx-2", orientation: "vertical", spacing: "sm" },
    { class: "mx-4", orientation: "vertical", spacing: "md" },
  ],
  defaultVariants: {
    orientation: "horizontal",
    spacing: "sm",
  },
  variants: {
    orientation: {
      horizontal: "w-full h-[1px]",
      vertical: "h-full w-[1px]",
    },
    spacing: availableVariants("sm", "md"),
  },
});

type SeparatorProps = AriaSeparatorProps &
  VariantProps<typeof separatorVariants> & { className?: string };

const Separator = ({
  className,
  orientation,
  spacing,
  ...rest
}: SeparatorProps) => {
  const { separatorProps } = useSeparator(rest);

  return (
    <div
      {...separatorProps}
      className={separatorVariants({ className, orientation, spacing })}
    />
  );
};

export default Separator;
