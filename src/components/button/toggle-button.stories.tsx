import { Meta, StoryObj } from "@storybook/react";

import { ToggleButton } from "./toggle-button";

const meta = {
  args: {
    off: "Deselected",
    on: "Selected",
  },
  component: ToggleButton,
  parameters: {
    controls: {
      exclude: ["className", "off", "on"],
    },
    layout: "centered",
  },
  title: "Toggle Button",
} satisfies Meta<typeof ToggleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
export const Default: Story = {};
