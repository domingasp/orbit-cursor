import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react-vite";

import { RenderVariants } from "../../../../.storybook/components/render-variants";
import { getVariantOptions } from "../../../lib/styling";
import { Text } from "../../typography/text/text";

import { stack, Stack } from "./stack";

const StackVariants = RenderVariants.for(Stack);
const spacing = getVariantOptions<typeof Stack>(stack)("spacing");
const align = getVariantOptions<typeof Stack>(stack)("align");

const meta = {
  component: Stack,
  title: "Layout/Stack",
  argTypes: {
    align: {
      control: "inline-radio",
      description: "Alignment of elements",
      options: align,
      table: {
        defaultValue: { summary: "start" },
        type: { summary: align.join(" | ") },
      },
    },
    spacing: {
      control: "inline-radio",
      description: "Space between elements",
      options: spacing,
      table: {
        defaultValue: { summary: "md" },
        type: { summary: spacing.join(" | ") },
      },
    },
    children: { control: false, description: "Elements to stack" },
    className: { control: false, description: "Override styles" },
  },
  args: {
    align: "start",
    spacing: "md",
    children: Array.from({ length: 3 }).map((_, i) => (
      <Text key={i}>{faker.word.words({ count: 1 })}</Text>
    )),
  },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */

export const Default: Story = {};

export const Spacing: Story = {
  parameters: { controls: { exclude: ["spacing"] } },
  render: (args) => (
    <StackVariants prop="spacing" restProps={args} variants={spacing} />
  ),
};

export const Align: Story = {
  parameters: { controls: { exclude: ["align"] } },
  render: (args) => (
    <StackVariants prop="align" restProps={args} variants={align} />
  ),
};
