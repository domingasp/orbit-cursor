import { Meta, StoryObj } from "@storybook/react";
import { Dialog, DialogTrigger } from "react-aria-components";

import Button from "../button/button";

import Modal from "./modal";

const meta = {
  args: { children: "Modal Content" },
  component: Modal,
  decorators: (Story) => (
    <DialogTrigger>
      <Button>Open</Button>
      <Story />
    </DialogTrigger>
  ),
  parameters: {
    controls: {
      exclude: ["children", "className"],
    },
  },
  title: "Modal",
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <Dialog className="flex flex-col gap-2 outline-none">
        {({ close }) => (
          <>
            <span>Modal Content</span>
            <Button className="self-end" onPress={close} variant="ghost">
              Close
            </Button>
          </>
        )}
      </Dialog>
    ),
    isDismissable: true,
  },
};
