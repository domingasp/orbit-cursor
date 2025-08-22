import { Meta, StoryObj } from "@storybook/react";
import { User } from "lucide-react";

import { TextField } from "./text-field";

const sizes: React.ComponentProps<typeof TextField>["size"][] = [
  "md",
  "sm",
] as const;
const variants: React.ComponentProps<typeof TextField>["variant"][] = [
  "solid",
  "line",
] as const;

const meta = {
  argTypes: {
    size: {
      control: "inline-radio",
      options: sizes,
      table: { defaultValue: { summary: "md" } },
    },
    variant: {
      control: "inline-radio",
      options: variants,
      table: { defaultValue: { summary: "solid" } },
    },
  },
  args: {
    defaultValue: "John Smith",
    label: "Full Name",
  },
  component: TextField,
  parameters: {
    controls: {
      exclude: ["className"],
    },
    layout: "centered",
  },
  title: "Text Field",
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
export const Default: Story = {
  args: {
    size: "md",
    variant: "solid",
  },
};

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: (args) => (
    <div className="flex gap-2 items-center">
      {sizes.map((size) => (
        <TextField key={size} size={size} {...args} />
      ))}
    </div>
  ),
};

export const Variants: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: (args) => (
    <div className="flex gap-2 items-center">
      {variants.map((variant) => (
        <TextField key={variant} variant={variant} {...args} />
      ))}
    </div>
  ),
};

export const Compact: Story = {
  args: {
    "aria-label": "Name",
    compact: true,
    defaultValue: "John Smith",
    label: undefined,
    size: "md",
    variant: "line",
  },
  parameters: { controls: { exclude: ["variant", "className", "aria-label"] } },
};

export const Sections: Story = {
  args: {
    leftSection: <User size={18} />,
    rightSection: <span className="text-xs">px</span>,
    variant: "solid",
  },
  parameters: { controls: { include: ["showSteppers", "variant"] } },
};
