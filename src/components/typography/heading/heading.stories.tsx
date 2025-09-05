import { faker } from "@faker-js/faker";
import { Meta, StoryObj } from "@storybook/react-vite";

import { RenderVariants } from "../../../../.storybook/components/render-variants";
import { getVariantOptions } from "../../../lib/styling";

import { heading, Heading } from "./heading";

const HeadingVariants = RenderVariants.for(Heading);
const levels = getVariantOptions<typeof Heading>(heading)("level");

const meta = {
  component: Heading,
  title: "Typography/Heading",
  parameters: { controls: { include: "level" } },
  argTypes: {
    level: {
      control: "select",
      description: "Heading level, from 1 to 6",
      options: levels.map(Number),
      table: { defaultValue: { summary: "3" } },
    },
  },
  args: { children: faker.lorem.word(), level: 3 },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */

export const Default: Story = {};

export const Levels: Story = {
  parameters: { controls: { exclude: ["level"] } },
  render: (args) => (
    <HeadingVariants
      orientation="vertical"
      prop="level"
      restProps={args}
      variants={levels}
    />
  ),
};
