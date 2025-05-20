import { Meta, StoryObj } from "@storybook/react";

import AudioMeter from "./audio-meter";

const meta: Meta<typeof AudioMeter> = {
  argTypes: {
    decibels: {
      control: { max: 2, min: -120, step: 0.01, type: "range" },
    },
    disabled: {
      control: { type: "boolean" },
    },
    height: {
      control: { max: 100, min: 5, step: 1, type: "range" },
    },
    orientation: {
      control: { disable: true },
    },
    width: {
      control: { max: 100, min: 5, step: 1, type: "range" },
    },
  },
  args: {
    decibels: -10,
  },
  component: AudioMeter,
  parameters: {
    layout: "centered",
  },
  title: "Inputs Selection/Audio Meter",
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Vertical: Story = {};

export const Horizontal: Story = {
  args: { orientation: "horizontal" },
};

export const Disabled: Story = {
  args: { disabled: true },
};
