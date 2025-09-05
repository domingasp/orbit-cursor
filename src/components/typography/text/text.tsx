import { TextProps as AriaTextProps } from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";

export const textElements = ["span", "p", "strong", "em", "label"] as const;
type TextElements = (typeof textElements)[number];

export const text = tv({
  base: "tabler-nums font-normal",

  defaultVariants: {
    align: "start",
    color: "default",
    size: "md",
    weight: "normal",
  },
  variants: {
    align: {
      center: "text-center",
      end: "text-end",
      justify: "text-justify",
      start: "text-start",
    },
    bold: {
      false: "",
      true: "font-bold",
    },
    color: {
      default: "text-text",
      secondary: "text-text-secondary",
    },
    size: {
      lg: "text-lg",
      md: "text-base",
      sm: "text-sm",
      xs: "text-xs",
    },
  },
});

type TextProps = AriaTextProps &
  VariantProps<typeof text> & { as?: TextElements };

export const Text = ({
  align,
  as: Component = "span",
  bold,
  className,
  color,
  size,
  ...props
}: TextProps) => {
  return (
    <Component
      {...props}
      className={text({ align, bold, className, color, size })}
    />
  );
};
