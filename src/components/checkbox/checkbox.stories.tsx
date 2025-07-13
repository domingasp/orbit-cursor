import { Meta, StoryObj } from "@storybook/react";

import Checkbox from "./checkbox";

const meta = {
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
export const Default: Story = {};
