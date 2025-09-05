import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";
import { spacing } from "../shared/spacing";

export const grid = tv({
  base: "grid",
  defaultVariants: {
    spacing: "md",
  },
  extend: spacing,
});

type GridProps = VariantProps<typeof grid> & {
  children: React.ReactNode;
  className?: string;
  cols?: number | string[];
};

export const Grid = ({ children, className, cols = 2, spacing }: GridProps) => {
  const gridColumns =
    typeof cols === "number"
      ? `repeat(${cols.toString()}, max-content)`
      : cols.join(" ");

  return (
    <div
      className={grid({ className, spacing })}
      style={{
        gridTemplateColumns: gridColumns,
      }}
    >
      {children}
    </div>
  );
};
