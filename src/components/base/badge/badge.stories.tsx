import { Meta, StoryObj } from "@storybook/react-vite";
import { Check } from "lucide-react";
import { ComponentProps } from "react";

import { Badge } from "./badge";

const sizes: React.ComponentProps<typeof Badge>["size"][] = [
  "md",
  "sm",
] as const;
const colors: React.ComponentProps<typeof Badge>["color"][] = [
  "neutral",
  "info",
  "warning",
  "error",
];

const defaultArgs: Omit<ComponentProps<typeof Badge>, "children"> = {
  color: "neutral",
  size: "md",
};

const meta = {
  argTypes: {
    color: {
      control: "inline-radio",
      options: colors,
      table: { defaultValue: { summary: "neutral" } },
    },
    size: {
      control: "inline-radio",
      options: sizes,
      table: { defaultValue: { summary: "md" } },
    },
  },
  args: {
    children: <>Default</>,
  },
  component: Badge,
  parameters: {
    controls: {
      exclude: ["className", "children"],
    },
    layout: "centered",
  },
  title: "Badge",
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
export const Default: Story = {
  args: {
    ...defaultArgs,
  },
};

export const Colors: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <div className="flex gap-2 items-center">
      {colors.map((color) => (
        <div key={color} className="flex flex-col items-center gap-1">
          <Badge color={color} {...args} />
          <span className="text-muted text-xs">{color}</span>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: (args) => (
    <div className="flex gap-2 items-end">
      {sizes.map((size) => (
        <div key={size} className="flex flex-col items-center gap-1">
          <Badge size={size} {...args} />
          <span className="text-muted text-xs">{size}</span>
        </div>
      ))}
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    ...defaultArgs,
    children: (
      <>
        <Check size={20} />
        Default
      </>
    ),
  },
};
