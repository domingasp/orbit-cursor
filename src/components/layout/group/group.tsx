import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";
import { spacing } from "../shared/spacing";

export const group = tv({
  base: "flex flex-row items-start",
  defaultVariants: {
    align: "start",
    spacing: "md",
  },
  extend: spacing,
  variants: {
    justify: {
      around: "justify-around",
      between: "justify-between",
      center: "justify-center",
      end: "justify-end",
      evenly: "justify-evenly",
      start: "justify-start",
    },
  },
});

type GroupProps = VariantProps<typeof group> & {
  children: React.ReactNode;
  className?: string;
};

export const Group = ({
  children,
  className,
  justify,
  spacing,
}: GroupProps) => {
  return (
    <div className={group({ className, justify, spacing })}>{children}</div>
  );
};
