import { Meta, StoryObj } from "@storybook/react";
import { DialogTrigger } from "react-aria-components";

import { Button } from "../button/button";

import { Popover } from "./popover";

const placements: React.ComponentProps<typeof Popover>["placement"][] = [
  "left",
  "top",
  "bottom",
  "end",
] as const;

const meta = {
  args: {
    children: "Content",
    className: "p-2",
  },
  component: Popover,
  parameters: {
    controls: { exclude: ["className", "children", "ref"] },
    layout: "centered",
  },
  title: "Popover",
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
export const Default: Story = {
  render: (args) => (
    <DialogTrigger>
      <Button>Open Popover</Button>
      <Popover {...args} />
    </DialogTrigger>
  ),
};

/** None exhaustive. */
export const Placements: Story = {
  parameters: {
    controls: { disable: true },
  },
  render: (args) => (
    <div className="flex gap-2 items-center">
      {placements.map((placement) => (
        <DialogTrigger key={placement} isOpen>
          <Button>Hello</Button>
          <Popover placement={placement} {...args} />
        </DialogTrigger>
      ))}
    </div>
  ),
};
