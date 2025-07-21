import { Meta, StoryObj } from "@storybook/react";
import { Check } from "lucide-react";

import Button from "../button/button";

import Toast, { ToastContent } from "./toast";
import ToastProvider, { useToast } from "./toast-provider";

const ToastButton = ({ toastContent }: { toastContent: ToastContent }) => {
  const toast = useToast();

  return (
    <Button
      onClick={() => {
        toast.add(toastContent);
      }}
    >
      Toast
    </Button>
  );
};

const meta = {
  args: {
    state: undefined,
    toast: {
      content: {
        description: "A toast description",
        leftSection: <Check className="text-success" size={20} />,
        title: "Some Title",
      },
      key: "1",
    },
  },
  component: Toast,
  decorators: (_Story, context) => {
    return (
      <ToastProvider>
        <ToastButton toastContent={context.args.toast.content} />
      </ToastProvider>
    );
  },
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
export const Default: Story = {};
