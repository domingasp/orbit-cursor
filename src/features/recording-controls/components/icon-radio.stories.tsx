import { Meta, StoryObj } from "@storybook/react";
import { Rabbit, Snail } from "lucide-react";

import Keyboard from "../../../components/keyboard/keyboard";
import RadioGroup from "../../../components/radio-group/radio-group";

import IconRadio from "./icon-radio";

const meta: Meta<typeof IconRadio> = {
  component: IconRadio,
  parameters: {
    controls: { disable: true },
    layout: "centered",
  },
  title: "Start Recording/Icon Option",
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup aria-label="Speed" orientation="horizontal">
      <IconRadio
        icon={<Rabbit />}
        shortcut={<Keyboard size="xs">⌘1</Keyboard>}
        subtext="Fast"
        value="fast"
      />
      <IconRadio icon={<Snail />} subtext="Slow" value="slow" />
    </RadioGroup>
  ),
};
