import {
  TextField as AriaTextField,
  Label,
  TextFieldProps as AriaTextFieldProps,
  Input,
  Group,
} from "react-aria-components";
import { VariantProps } from "tailwind-variants";

import { tv } from "../../../../tailwind-merge.config";
import { availableVariants } from "../../../lib/styling";

import { inputFieldVariants } from "./input-field";

const textFieldVariants = tv({
  compoundVariants: [
    { class: { input: "py-0.5" }, compact: true, size: "md", variant: "line" },
    { class: { input: "py-0.5" }, compact: true, size: "sm", variant: "line" },
  ],
  extend: inputFieldVariants,
  variants: {
    compact: availableVariants("true"),
  },
});

export type TextFieldProps = AriaTextFieldProps &
  VariantProps<typeof textFieldVariants> & {
    className?: string;
    label?: string;
    leftSection?: React.ReactNode;
    lineClassName?: string;
    placeholder?: string;
    rightSection?: React.ReactNode;
  };

export const TextField = ({
  centered,
  className,
  compact,
  label,
  leftSection,
  lineClassName,
  placeholder,
  rightSection,
  size,
  variant,
  ...props
}: TextFieldProps) => {
  const {
    base,
    field,
    input,
    inputWrapper,
    label: _label,
    line,
  } = textFieldVariants({
    centered,
    compact,
    isInvalid: props.isInvalid,
    size,
    variant,
  });

  return (
    <AriaTextField {...props} className={base({ className })}>
      {label && <Label className={_label()}>{label}</Label>}

      <Group className={field()}>
        <div className={inputWrapper()}>
          {leftSection}

          <Input className={input()} placeholder={placeholder} />

          {rightSection}
        </div>

        {variant === "line" && (
          <div className={line({ className: lineClassName })} />
        )}
      </Group>
    </AriaTextField>
  );
};
