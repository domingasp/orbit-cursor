import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";

const badgeVariants = tv({
  base: "flex flex-row items-center justify-center",
  defaultVariants: {
    color: "neutral",
    size: "md",
    variant: "outline",
  },
  variants: {
    color: {
      error: "text-error border-error",
      info: "text-info border-info",
      neutral: "text-muted border-muted",
      warning: "text-warning border-warning",
    },
    size: {
      md: "text-sm px-2 py-1 gap-1 rounded-lg",
      sm: "text-xs px-1.5 py-0.5 gap-1 rounded-md",
    },
    variant: {
      ghost: "",
      outline: "border-1",
    },
  },
});

type BadgeProps = VariantProps<typeof badgeVariants> & {
  children: React.ReactNode;
  className?: string;
};

export const Badge = ({
  children,
  className,
  color,
  size,
  variant,
}: BadgeProps) => {
  return (
    <div className={badgeVariants({ className, color, size, variant })}>
      {children}
    </div>
  );
};
