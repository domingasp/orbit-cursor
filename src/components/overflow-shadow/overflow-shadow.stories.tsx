import { Meta, StoryObj } from "@storybook/react";

import OverflowShadow from "./overflow-shadow";

/** Parent container must have `relative` and `overflow-hidden` applied. */
const meta = {
  argTypes: {
    orientation: {
      control: "inline-radio",
      options: ["vertical", "horizontal"],
      table: { readonly: true },
    },
  },
  args: {
    children: (
      <>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
        commodo consequat.
      </>
    ),
  },
  component: OverflowShadow,
  parameters: {
    controls: { exclude: ["children"] },
    layout: "centered",
  },
  title: "Overflow Shadow",
} satisfies Meta<typeof OverflowShadow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
  render: (args) => (
    <div className="text-content-fg w-[150px] h-[100px] relative overflow-hidden">
      <OverflowShadow {...args} />
    </div>
  ),
};

export const Horizontal: Story = {
  args: {
    orientation: "horizontal",
  },
  render: (args) => (
    <div className="text-content-fg w-[150px] whitespace-nowrap relative overflow-hidden">
      <OverflowShadow {...args} />
    </div>
  ),
};
