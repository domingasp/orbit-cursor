import { ComponentProps } from "react";
import {
  Control,
  FieldPathByValue,
  FieldValues,
  useController,
} from "react-hook-form";

import { Checkbox } from "./checkbox";

type CheckboxControlledProps<TFieldValues extends FieldValues = FieldValues> =
  ComponentProps<typeof Checkbox> & {
    control: Control<TFieldValues>;
    name: FieldPathByValue<TFieldValues, boolean>;
  };
export const CheckboxControlled = <
  TFieldValues extends FieldValues = FieldValues
>({
  control,
  name,
  ...props
}: CheckboxControlledProps<TFieldValues>) => {
  const {
    field: { onChange, value },
  } = useController({ control, name });

  return (
    <Checkbox
      isSelected={value}
      value={name}
      onChange={(isSelected) => {
        onChange(isSelected);
      }}
      {...props}
    />
  );
};
