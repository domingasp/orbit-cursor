import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react";
import { Check } from "lucide-react";

import Button from "../button/button";

import Toast from "./toast";
import ToastProvider, { useToast } from "./toast-provider";

const ToastButton = () => {
  const toast = useToast();

  return (
    <Button
      onClick={() => {
        toast.add({
          description: faker.lorem.words({ max: 10, min: 1 }),
          leftSection: <Check className="text-success" size={20} />,
          title: faker.lorem.words({ max: 2, min: 1 }),
        });
      }}
    >
      Toast
    </Button>
  );
};

const meta = {
  args: {
    expanded: false,
    state: undefined,
    toast: {
      content: {
        description: faker.lorem.sentences({ max: 3, min: 1 }),
        leftSection: <Check className="text-success" size={20} />,
        title: faker.lorem.words(),
      },
      key: "1",
    },
  },
  component: Toast,
  parameters: {
    controls: {
      exclude: ["toast", "state", "ref"],
    },
    layout: "centered",
  },
  title: "Toast",
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
/** To be wrapped with a `ToastRegion` at the root of the app. */
export const Top: Story = {
  decorators: (_Story) => (
    <ToastProvider position="top">
      <ToastButton />
    </ToastProvider>
  ),
};

export const Bottom: Story = {
  decorators: (_Story) => (
    <ToastProvider position="bottom">
      <ToastButton />
    </ToastProvider>
  ),
};
