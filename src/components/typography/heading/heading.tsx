import {
  HeadingProps as AriaHeadingProps,
  HeadingContext,
  useContextProps,
} from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";

export const heading = tv({
  base: "text-text font-bold",
  defaultVariants: {
    level: 3,
  },
  variants: {
    level: {
      1: "text-4xl",
      2: "text-3xl",
      3: "text-2xl",
      4: "text-xl",
      5: "text-lg",
      6: "text-md",
    },
  },
});

type HeadingProps = AriaHeadingProps &
  VariantProps<typeof heading> & { ref?: React.Ref<HTMLHeadingElement> };

export const Heading = ({ ref, ...props }: HeadingProps) => {
  [props, ref] = useContextProps(props, ref ?? null, HeadingContext);

  const { children, level = 3, ...otherProps } = props;
  const normalizedLevel = Math.min(6, Math.max(1, level)) as
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6;

  const HeadingTag = `h${normalizedLevel.toString()}` as React.ElementType;

  return (
    <HeadingTag
      {...otherProps}
      ref={ref}
      className={heading({ level: normalizedLevel })}
    >
      {children}
    </HeadingTag>
  );
};
