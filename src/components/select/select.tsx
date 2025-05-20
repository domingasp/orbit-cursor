import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { Ref } from "react";
import {
  Select as AriaSelect,
  SelectProps as AriaSelectProps,
  Button,
  Label,
  Popover,
  SelectValue,
} from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../tailwind-merge.config";
import { elementFocus, focusStyles } from "../../lib/styling";
import ListBox from "../listbox/listbox";

import ClearButton from "./components/clear-button";

const ICON_SIZES = {
  md: 16,
  sm: 14,
};

const selectVariants = tv({
  defaultVariants: {
    size: "md",
    variant: "solid",
  },
  slots: {
    base: "flex flex-col gap-1 w-full",
    controls: "text-muted/75",
    label: "text-muted font-medium",
    trigger: [
      "shrink inline-flex flex-row items-center justify-between text-content-fg gap-4 rounded-md transition-colors",
      "data-[hovered]:bg-neutral/50",
      focusStyles,
      elementFocus,
    ],
  },
  variants: {
    size: {
      md: { label: "text-sm", trigger: "text-sm pl-3 pr-2 py-2" },
      sm: { label: "text-xs", trigger: "text-xs pl-3 pr-2 py-2" },
    },
    variant: {
      ghost: {
        trigger: "px-2 py-1",
      },
      solid: {
        trigger: "bg-content border-1 border-muted/30",
      },
    },
  },
});

type SelectProps<T extends object> = AriaSelectProps<T> &
  VariantProps<typeof selectVariants> & {
    children?: React.ReactNode | ((item: T) => React.ReactNode);
    className?: string;
    clearable?: boolean;
    items?: Iterable<T>;
    label?: string;
    leftSection?: React.ReactNode;
    onClear?: () => void;
    onPress?: () => void;
    /**
     * @default false
     * @type boolean
     * @description
     * You'll need to provide and control the visibility of your own
     * listbox
     */
    standalone?: boolean;
    triggerRef?: Ref<HTMLButtonElement>;
  };

const Select = <T extends object>({
  children,
  className,
  clearable = true,
  items,
  label,
  leftSection,
  onClear,
  onPress,
  placeholder,
  size,
  standalone,
  triggerRef,
  variant,
  ...props
}: SelectProps<T>) => {
  const {
    base,
    controls,
    label: _label,
    trigger,
  } = selectVariants({ size, variant });

  return (
    <AriaSelect {...props} className={base()}>
      {({ isOpen }) => (
        <>
          {label && <Label className={_label()}>{label}</Label>}

          <div className="relative">
            <Button
              ref={triggerRef}
              className={trigger({ className })}
              onPress={onPress}
            >
              <div className="inline-flex flex-row items-center gap-2 flex-1 min-w-0">
                {leftSection && <div>{leftSection}</div>}

                <SelectValue className="data-[placeholder]:text-muted/75 truncate">
                  {({ defaultChildren, isPlaceholder }) =>
                    isPlaceholder ? placeholder : defaultChildren
                  }
                </SelectValue>
              </div>

              <motion.div
                aria-hidden="true"
                className={controls({ className: "ml-3" })}
                animate={{
                  rotate: isOpen ? 180 : 0,
                  y: isOpen ? -0.5 : 0,
                }}
                transition={{
                  duration: 0.2,
                }}
              >
                <ChevronDown size={size ? ICON_SIZES[size] : 16} />
              </motion.div>
            </Button>

            <AnimatePresence>
              {clearable && (
                <ClearButton
                  animate={{ opacity: 1 }}
                  className={controls()}
                  initial={{ opacity: 0 }}
                  onClear={onClear}
                  size={12}
                  exit={{
                    opacity: 0,
                    scale: 0,
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          <Popover
            // Standalone still needs listbox to be rendered to show a display value
            isOpen={standalone ? false : undefined}
            className={({ placement }) =>
              clsx(
                isOpen ? "animate-in fade-in" : "animate-out fade-out",
                isOpen
                  ? placement === "bottom"
                    ? "slide-in-from-top-5"
                    : "slide-in-from-bottom-5"
                  : placement === "bottom"
                  ? "slide-out-to-top-5"
                  : "slide-out-to-bottom-5"
              )
            }
          >
            <ListBox items={items}>{children}</ListBox>
          </Popover>
        </>
      )}
    </AriaSelect>
  );
};

export default Select;
