import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react";

import { RecordingType } from "../../../stores/recording-state.store";

import { RecordingItem } from "./recording-item";

const meta: Meta<typeof RecordingItem> = {
  args: {
    recording: {
      createdAt: new Date(2020, 11, 1, 10, 29, 38),
      id: 1,
      lengthMs: faker.number.int({ max: 1000 * 60 * 10, min: 1000 }),
      name: faker.word.words({ count: { max: 8, min: 1 } }),
      sizeBytes: faker.number.int({ max: 1024 ** 3.1, min: 1024 }),
      type: faker.helpers.enumValue(RecordingType),
    },
  },
  component: RecordingItem,
  parameters: {
    layout: "centered",
  },
  render: (args) => (
    <div className="w-80 text-center flex flex-col gap-2">
      <RecordingItem {...args} />

      <span className="text-muted text-xxs">
        Storybook container <code className="text-info">w-80</code>
      </span>
    </div>
  ),
  title: "Recording List/Recording Item",
};

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
export const Default: Story = {};
