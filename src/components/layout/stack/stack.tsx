import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";
import { spacing } from "../shared/spacing";

export const stack = tv({
  base: "flex flex-col",
  defaultVariants: {
    align: "start",
    spacing: "md",
  },
  extend: spacing,
  variants: {
    align: {
      center: "items-center",
      end: "items-end",
      start: "items-start",
    },
  },
});

type StackProps = VariantProps<typeof stack> & {
  children: React.ReactNode;
  className?: string;
};

export const Stack = ({ align, children, className, spacing }: StackProps) => {
  return <div className={stack({ align, className, spacing })}>{children}</div>;
};
