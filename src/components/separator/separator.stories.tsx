import { Meta, StoryObj } from "@storybook/react";

import Separator from "./separator";

const meta = {
  argTypes: {
    orientation: {},
  },
  component: Separator,
  parameters: {
    controls: { disable: true },
    layout: "centered",
  },
  title: "Separator",
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
export const Horizontal: Story = {
  render: () => (
    <div className="text-content-fg text-center">
      Hello
      <Separator />
      World!
    </div>
  ),
};

/**
 * The container will need a determined height, otherwise use a class like `h-[10px]`.
 */
export const Vertical: Story = {
  render: () => (
    <div className="text-content-fg text-center flex">
      Hello
      <Separator className="h-[20px]" orientation="vertical" />
      World!
    </div>
  ),
};
