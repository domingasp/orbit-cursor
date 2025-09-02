import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react-vite";

import { recordingType } from "../../../stores/recording-state.store";
import { RecordingMetadata } from "../api/recordings";

import { RecordingItem } from "./recording-item";

const defaultRecording: RecordingMetadata = {
  createdAt: new Date(2020, 11, 1, 10, 29, 38),
  deletedAt: null,
  hasCamera: faker.datatype.boolean(),
  hasMicrophone: faker.datatype.boolean(),
  hasSystemAudio: faker.datatype.boolean(),
  hasSystemCursor: faker.datatype.boolean(),
  id: 1,
  lengthMs: faker.number.int({ max: 1000 * 60 * 10, min: 1000 }),
  name: faker.word.words({ count: { max: 8, min: 1 } }),
  sizeBytes: faker.number.int({ max: 1024 ** 3.1, min: 1024 }),
  type: faker.helpers.enumValue(recordingType),
};

const meta: Meta<typeof RecordingItem> = {
  args: {
    recording: defaultRecording,
    searchTerm: undefined,
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

export const Deleted: Story = {
  render: (args) => (
    <div className="w-80 text-center flex flex-col gap-2">
      <RecordingItem
        {...args}
        recording={{
          ...defaultRecording,
          deletedAt: faker.date.recent({ days: 30 }),
        }}
      />

      <span className="text-muted text-xxs">
        Storybook container <code className="text-info">w-80</code>
      </span>
    </div>
  ),
};
