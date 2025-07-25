import { motion, MotionProps } from "motion/react";
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
    {
      class: "bg-neutral/75",
      color: "neutral",
      variant: "soft",
    },
    { class: "justify-center h-10 w-10 p-1.5", icon: true, size: "lg" },
    { class: "justify-center h-9 w-9 p-1.5", icon: true, size: "md" },
    { class: "justify-center h-6 w-6 p-1", icon: true, size: "sm" },
  ],
  defaultVariants: {
    color: "neutral",
    showFocus: true,
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
    icon: { true: [] },
    shiny: {
      true: [
        "relative",
        "mask-[linear-gradient(-75deg,var(--color-content)_calc(var(--x)_+_20%),transparent_calc(var(--x)_+_30%),var(--color-content)_calc(var(--x)_+_100%))]",
      ],
    },
    showFocus: { true: elementFocus },
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
  } as MotionProps);

type ButtonProps = AriaButtonProps &
  VariantProps<typeof buttonVariants> &
  MotionProps & {
    className?: string;
    ref?: Ref<HTMLButtonElement>;
    shiny?: boolean;
    slot?: string;
  };

const MotionAriaButton = motion.create(AriaButton);

export const Button = ({
  children,
  className,
  color,
  icon,
  shiny,
  showFocus,
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
        icon,
        shiny,
        showFocus,
        size,
        variant,
      })}
    >
      {children}
    </MotionAriaButton>
  );
};
