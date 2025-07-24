import { Meta, StoryObj } from "@storybook/react";
import { Cog } from "lucide-react";

import CircularProgressBar from "./circular-progress-bar";

const meta = {
  argTypes: {
    size: {
      control: { max: 200, min: 14, step: 1, type: "range" },
    },
    strokeWidth: {
      control: { max: 30, min: 1, step: 1, type: "range" },
    },
    value: {
      control: { max: 100, min: 0, step: 1, type: "range" },
    },
  },
  args: {
    size: 100,
  },
  component: CircularProgressBar,
  parameters: {
    controls: {
      exclude: ["aria-label"],
    },
    layout: "centered",
  },
  title: "Circular Progress Bar",
} satisfies Meta<typeof CircularProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
export const Default: Story = {
  args: {
    "aria-label": "Example Progress",
    hideBackdrop: false,
    indeterminate: false,
    strokeWidth: 10,
    value: 10,
  },
  parameters: {
    controls: {
      exclude: ["renderLabel"],
    },
  },
};

export const Indeterminate: Story = {
  argTypes: {
    indeterminate: {
      table: { readonly: true },
    },
  },
  args: { indeterminate: true },
  parameters: { controls: { include: "indeterminate" } },
};

/** Position a custom label with `renderLabel`. */
export const CustomLabel: Story = {
  args: {
    renderLabel: (value) => (
      <>
        <div className="absolute inset-0 flex items-center justify-center">
          <Cog className="text-content-fg animate-spin" size={50} />
        </div>

        <span className="absolute right-0 bottom-0 font-bold text-content-fg">
          {value?.toLocaleString()}
        </span>
      </>
    ),
    value: 25,
  },
  parameters: {
    controls: {
      exclude: ["hideBackdrop", "indeterminate"],
    },
  },
};
