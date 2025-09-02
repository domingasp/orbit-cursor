import { DoorOpen, HandMetal } from "lucide-react";

import { Button } from "./button";

import type { Meta, StoryObj } from "@storybook/react-vite";

const sizes: React.ComponentProps<typeof Button>["size"][] = [
  "lg",
  "md",
  "sm",
  "xs",
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

const iconSizes: Record<
  NonNullable<React.ComponentProps<typeof Button>["size"]>,
  number
> = {
  lg: 30,
  md: 24,
  sm: 16,
  xs: 12,
};

const meta = {
  argTypes: {
    color: {
      control: "inline-radio",
      options: colors,
    },
    isDisabled: {
      control: "boolean",
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
    color: "neutral",
  },
  component: Button,
  parameters: {
    controls: {
      exclude: ["ref", "className", "slot"],
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
    isDisabled: false,
    /* eslint-enable sort-keys */
  },
};

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: (args) => (
    <div className="flex items-center gap-2">
      {sizes.map((size) => (
        <Button key={size} size={size} {...args} />
      ))}
    </div>
  ),
};

export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <div className="flex items-center gap-2">
      {variants.map((variant) => (
        <Button key={variant} color="info" variant={variant} {...args} />
      ))}
    </div>
  ),
};

export const Colors: Story = {
  parameters: { controls: { disable: true } },
  render: (args) => (
    <div className="flex items-center gap-2">
      {colors.map((color) => (
        <Button key={color} color={color} {...args} />
      ))}
    </div>
  ),
};

export const WithElements: Story = {
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
export const Icon: Story = {
  args: {
    "aria-label": "Sign out",
    icon: true,
  },
  parameters: { controls: { disable: true } },
  render: (args) => (
    <div className="flex items-center gap-2">
      {sizes.map((size) => (
        <Button key={size} color="info" size={size} {...args}>
          <DoorOpen size={iconSizes[size as keyof typeof iconSizes]} />
        </Button>
      ))}
    </div>
  ),
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
