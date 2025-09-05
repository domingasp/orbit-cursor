import React from "react";

import { Grid } from "../../src/components/layout/grid/grid";
import { Group } from "../../src/components/layout/group/group";
import { Stack } from "../../src/components/layout/stack/stack";
import { Text } from "../../src/components/typography/text/text";

type RenderVariantsProps<
  C extends React.ElementType,
  P extends keyof React.ComponentProps<C>,
> = {
  prop: P;
  variants: React.ComponentProps<C>[P][];
  className?: string;
  orientation?: "horizontal" | "vertical";
  restProps?: Omit<React.ComponentProps<C>, P>;
};

const createRenderVariants = <C extends React.ElementType>(component: C) =>
  function RenderVariants<P extends keyof React.ComponentProps<C>>({
    className,
    orientation = "horizontal",
    prop,
    restProps,
    variants,
  }: RenderVariantsProps<C, P>) {
    const renderLabel = (label: string) => (
      <Text align="center" className="self-center" color="secondary" size="sm">
        {label}
      </Text>
    );

    const renderVariant = (variant: React.ComponentProps<C>[P]) => {
      const props = {
        ...restProps,
        [prop]: variant,
      } as unknown;

      if (orientation === "horizontal") {
        return (
          <Stack key={String(variant)} align="center" spacing="sm">
            {renderLabel(String(variant))}
            {React.createElement(component, props)}
          </Stack>
        );
      }

      return (
        <React.Fragment key={String(variant)}>
          {renderLabel(String(variant))}
          {React.createElement(component, props)}
        </React.Fragment>
      );
    };
    if (orientation === "horizontal") {
      return <Group className={className}>{variants.map(renderVariant)}</Group>;
    }

    return (
      <Grid className={className} cols={["max-content", "1fr"]}>
        {variants.map(renderVariant)}
      </Grid>
    );
  };

export const RenderVariants = {
  for: createRenderVariants,
};
