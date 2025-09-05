import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react-vite";

import { RenderVariants } from "../../../../.storybook/components/render-variants";
import { getVariantOptions } from "../../../lib/styling";
import { Text } from "../../typography/text/text";

import { group, Group } from "./group";

const GroupVariants = RenderVariants.for(Group);
const spacing = getVariantOptions<typeof Group>(group)("spacing");
const justify = getVariantOptions<typeof Group>(group)("justify");

const meta = {
  component: Group,
  title: "Layout/Group",
  argTypes: {
    justify: {
      control: "inline-radio",
      description: "Justify content",
      options: justify,
      table: {
        type: { summary: justify.join(" | ") },
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
    spacing: "md",
    justify: "start",
    children: Array.from({ length: 3 }).map((_, i) => (
      <Text key={i}>{faker.lorem.word()}</Text>
    )),
  },
} satisfies Meta<typeof Group>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */

export const Default: Story = {};

export const Spacing: Story = {
  parameters: { controls: { exclude: ["spacing"] } },
  render: (args) => (
    <GroupVariants
      orientation="vertical"
      prop="spacing"
      restProps={args}
      variants={spacing}
    />
  ),
};

export const Justify: Story = {
  parameters: { controls: { exclude: ["justify"] } },
  render: (args) => (
    <GroupVariants
      orientation="vertical"
      prop="justify"
      restProps={args}
      variants={justify}
    />
  ),
};
