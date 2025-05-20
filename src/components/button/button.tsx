import { AnimationProps, motion, MotionProps } from "motion/react";
import { Ref } from "react";
import { AriaButtonProps } from "react-aria";
import { Button as AriaButton } from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../tailwind-merge.config";
import { elementFocus, focusStyles } from "../../lib/styling";

const buttonVariants = tv({
  base: [
    "inline-flex items-center gap-2 rounded-md font-semibold transition",
    focusStyles,
    elementFocus,
  ],
  compoundVariants: [
    {
      class: [
        "text-info",
        "data-[hovered]:bg-info/10",
        "data-[pressed]:bg-info/5",
      ],
      color: "info",
      variant: "ghost",
    },
    {
      class: [
        "text-info bg-info/20",
        "data-[hovered]:bg-info/15",
        "data-[pressed]:bg-info/10",
      ],
      color: "info",
      variant: "soft",
    },
  ],
  defaultVariants: {
    color: "neutral",
    size: "md",
    type: "solid",
  },
  variants: {
    color: {
      info: [
        "text-white bg-info",
        "data-[hovered]:bg-info/90",
        "data-[pressed]:bg-info/80",
      ],
      neutral: [
        "text-content-fg bg-neutral",
        "data-[hovered]:bg-neutral-100",
        "data-[pressed]:bg-neutral/80",
      ],
      success: [
        "text-white bg-success",
        "data-[hovered]:bg-success/90",
        "data-[pressed]:bg-success/80",
      ],
    },
    shiny: {
      true: [
        "relative",
        "mask-[linear-gradient(-75deg,var(--color-content)_calc(var(--x)_+_20%),transparent_calc(var(--x)_+_30%),var(--color-content)_calc(var(--x)_+_100%))]",
      ],
    },
    size: {
      lg: "text-md px-4 py-2",
      md: "text-sm px-3 py-2",
      sm: "text-xs px-2 py-1",
    },
    variant: {
      ghost: [
        "bg-transparent cursor-pointer",
        "data-[hovered]:bg-transparent",
        "data-[pressed]:bg-transparent",
      ],
      soft: "bg-opacity-20 border-none",
      solid: "border-none",
    },
  },
});

const shinyAnimationProps = () =>
  ({
    animate: { "--x": "-100%" },
    initial: { "--x": "100%" },
    transition: {
      damping: 15,
      delay: Math.random() + 0.5,
      mass: 2,
      repeat: Infinity,
      repeatType: "loop",
      stiffness: 20,
      type: "spring",
    },
  } as AnimationProps);

type ButtonProps = AriaButtonProps &
  VariantProps<typeof buttonVariants> &
  MotionProps & {
    className?: string;
    ref?: Ref<HTMLButtonElement>;
    shiny?: boolean;
  };

const MotionAriaButton = motion.create(AriaButton);

const Button = ({
  children,
  className,
  color,
  shiny,
  size,
  variant,
  ...props
}: ButtonProps) => {
  return (
    <MotionAriaButton
      {...props}
      {...(shiny && shinyAnimationProps())}
      className={buttonVariants({
        className,
        color,
        shiny,
        size,
        variant,
      })}
    >
      {children}
    </MotionAriaButton>
  );
};

export default Button;
