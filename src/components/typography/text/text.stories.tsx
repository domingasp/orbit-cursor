import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react-vite";

import { RenderVariants } from "../../../../.storybook/components/render-variants";
import { getVariantOptions } from "../../../lib/styling";

import { text, Text, textElements } from "./text";

const TextVariants = RenderVariants.for(Text);
const sizes = getVariantOptions<typeof Text>(text)("size");
const colors = getVariantOptions<typeof Text>(text)("color");

const meta = {
  component: Text,
  title: "Typography/Text",
  argTypes: {
    as: {
      control: "select",
      description: "HTML element to render",
      options: textElements,
      table: {
        defaultValue: { summary: "span" },
        type: { summary: textElements.join(" | ") },
      },
    },
    color: {
      control: "inline-radio",
      description: "Color",
      options: colors,
      table: {
        defaultValue: { summary: "default" },
        type: { summary: colors.join(" | ") },
      },
    },
    size: {
      control: "inline-radio",
      description: "Size of the text",
      options: sizes,
      table: {
        defaultValue: { summary: "md" },
        type: { summary: sizes.join(" | ") },
      },
    },
    bold: {
      control: "boolean",
      description: "Whether the text is bold",
      table: { defaultValue: { summary: "false" } },
    },
    children: { control: "text", description: "Text content" },
  },
  args: {
    as: "span",
    color: "default",
    size: "md",
    bold: false,
    children: faker.lorem.sentence(),
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */

export const Default: Story = {};

export const Sizes: Story = {
  parameters: { controls: { exclude: ["size"] } },
  render: (args) => (
    <TextVariants prop="size" restProps={args} variants={sizes} />
  ),
};

export const Colors: Story = {
  parameters: { controls: { exclude: ["color"] } },
  render: (args) => (
    <TextVariants prop="color" restProps={args} variants={colors} />
  ),
};

export const Bold: Story = {
  parameters: { controls: { include: ["bold"] } },
  args: { bold: true },
};

export const Nested: Story = {
  parameters: { controls: { disable: true } },
  args: {
    children: (
      <>
        <Text bold>Hello</Text> World!
      </>
    ),
  },
};
