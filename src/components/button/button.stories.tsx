import { Meta, StoryObj } from "@storybook/react";
import { DoorOpen, HandMetal } from "lucide-react";

import { Button } from "./button";

const sizes: React.ComponentProps<typeof Button>["size"][] = [
  "lg",
  "md",
  "sm",
] as const;
const variants: React.ComponentProps<typeof Button>["variant"][] = [
  "solid",
  "soft",
  "ghost",
] as const;
const colors: React.ComponentProps<typeof Button>["color"][] = [
  "neutral",
  "success",
  "info",
];

const meta = {
  argTypes: {
    color: {
      control: "inline-radio",
      options: colors,
    },
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
    children: "Default",
  },
  component: Button,
  parameters: {
    controls: {
      exclude: ["ref", "className"],
    },
    layout: "centered",
  },
  title: "Button",
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
export const Default: Story = {
  args: {
    /* eslint-disable sort-keys */
    size: "md",
    variant: "solid",
    shiny: false,
    /* eslint-enable sort-keys */
  },
};

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: (args) => (
    <div className="flex gap-2 items-center">
      {sizes.map((size) => (
        <Button key={size} size={size} {...args} />
      ))}
    </div>
  ),
};

export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <div className="flex gap-2 items-center">
      {variants.map((variant) => (
        <Button key={variant} color="info" variant={variant} {...args} />
      ))}
    </div>
  ),
};

export const Colors: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <div className="flex gap-2 items-center">
      {colors.map((color) => (
        <Button key={color} color={color} {...args} />
      ))}
    </div>
  ),
};

export const Icons: Story = {
  args: {
    children: (
      <>
        <DoorOpen size={18} />
        Sign out
        <HandMetal size={18} />
      </>
    ),
  },
  parameters: { controls: { disable: true } },
};

/** Set the `aria-label` prop! */
export const IconOnly: Story = {
  args: {
    "aria-label": "Sign out",
    children: <DoorOpen size={18} />,
  },
  parameters: { controls: { disable: true } },
};

export const Shiny: Story = {
  args: { shiny: true },
  parameters: { controls: { disable: true } },
};

export const Animated: Story = {
  args: {
    whileHover: { rotate: 5, scale: 1.5 },
  },
  parameters: { controls: { disable: true } },
};
