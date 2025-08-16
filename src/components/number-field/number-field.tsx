import { Minus, Plus } from "lucide-react";
import {
  Button,
  Group,
  Input,
  NumberField as AriaNumberField,
  NumberFieldProps as AriaNumberFieldProps,
  Label,
} from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../tailwind-merge.config";
import { focusStyles, focusWithin } from "../../lib/styling";

const ICON_SIZES = {
  md: 16,
  sm: 14,
};

const numberFieldVariants = tv({
  compoundVariants: [
    { class: { input: "py-1.5" }, size: "md", variant: "line" },
    { class: { input: "py-1.5" }, size: "sm", variant: "line" },
  ],
  defaultVariants: {
    size: "md",
    variant: "solid",
  },
  slots: {
    base: "flex flex-col gap-1 w-full",
    field: "group relative flex flex-row items-center",
    input: "text-content-fg outline-none w-full",
    inputWrapper:
      "outline-none text-muted/75 flex flex-row items-center justify-between w-full gap-3",
    label: "text-muted font-medium tabular-nums",
    line: [
      "absolute bottom-0 inset-x-1 bg-transparent h-[2px] pointer-events-none transition-shadow shadow-[0_1px_0_0] shadow-muted/30",
      "group-data-[focus-within]:shadow-[0_2px_0_0] group-data-[focus-within]:shadow-content-fg/75",
    ],
    stepper: [
      "text-muted/75 px-3 self-stretch transition-colors",
      "data-[hovered]:text-content-fg",
    ],
  },
  variants: {
    centered: { true: { input: "text-center" } },
    size: {
      md: {
        input: "text-sm py-2",
        inputWrapper: "px-2",
        label: "text-sm",
      },
      sm: {
        input: "text-xs py-2",
        inputWrapper: "px-2",
        label: "text-xs",
      },
    },
    steppers: {
      false: {
        inputWrapper: "px-3",
      },
      true: { inputWrapper: "px-0" },
    },
    variant: {
      line: {},
      solid: {
        field: ["border border-muted/30 rounded-md", focusStyles, focusWithin],
      },
    },
  },
});

export type NumberFieldProps = AriaNumberFieldProps &
  VariantProps<typeof numberFieldVariants> & {
    centered?: boolean;
    className?: string;
    label?: string;
    leftSection?: React.ReactNode;
    rightSection?: React.ReactNode;
    showSteppers?: boolean;
  };

export const NumberField = ({
  centered,
  className,
  label,
  leftSection,
  rightSection,
  showSteppers = true,
  size,
  variant,
  ...props
}: NumberFieldProps) => {
  const {
    base,
    field,
    input,
    inputWrapper,
    label: _label,
    line,
    stepper,
  } = numberFieldVariants({
    centered,
    size,
    steppers: showSteppers,
    variant,
  });

  return (
    <AriaNumberField {...props} className={base({ className })}>
      {label && <Label className={_label()}>{label}</Label>}

      <Group className={field()}>
        {showSteppers && (
          <Button aria-label="Decrement" className={stepper()} slot="decrement">
            <Minus size={size ? ICON_SIZES[size] : 16} />
          </Button>
        )}

        <div className={inputWrapper()}>
          {leftSection}

          <Input className={input()} />

          {rightSection}
        </div>

        {showSteppers && (
          <Button aria-label="Increment" className={stepper()} slot="increment">
            <Plus size={size ? ICON_SIZES[size] : 16} />
          </Button>
        )}

        {variant === "line" && <div className={line()} />}
      </Group>
    </AriaNumberField>
  );
};
