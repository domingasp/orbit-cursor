import { Meta, StoryObj } from "@storybook/react-vite";

import { Checkbox } from "./checkbox";

const sizes: React.ComponentProps<typeof Checkbox>["size"][] = [
  "md",
  "sm",
  "xs",
] as const;

const meta = {
  argTypes: {
    size: {
      control: "inline-radio",
      options: sizes,
      table: { defaultValue: { summary: "md" } },
    },
  },
  args: {
    children: "Label",
  },
  component: Checkbox,
  parameters: {
    controls: {
      controls: ["className"],
    },
    layout: "centered",
  },
  title: "Checkbox",
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
export const Default: Story = {
  args: {
    size: "md",
  },
};

export const Sizes: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: (args) => (
    <div className="flex flex-col gap-4 items-center">
      {sizes.map((size) => (
        <Checkbox key={size} size={size} {...args} />
      ))}
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    isDisabled: true,
    isSelected: true,
  },
  parameters: {
    controls: {
      exclude: ["children"],
    },
  },
};
