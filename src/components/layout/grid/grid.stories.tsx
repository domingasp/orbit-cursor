import { Meta, StoryObj } from "@storybook/react-vite";

import { getVariantOptions } from "../../../lib/styling";

import { grid, Grid } from "./grid";

const spacing = getVariantOptions<typeof Grid>(grid)("spacing");

const meta = {
  component: Grid,
  title: "Layout/Grid",
  argTypes: {
    cols: {
      control: "number",
      description: "Number of columns, can be array of sizes",
      table: {
        defaultValue: { summary: "2" },
        type: { summary: "number | string[]" },
      },
    },
    spacing: {
      control: "inline-radio",
      description: "Space between elements",
      options: spacing,
      table: {
        defaultValue: { summary: "md" },
        type: { summary: spacing.join(" | ") },
      },
    },
    children: {
      // Ideally, this would remove the control in stories and show in docs
      // https://github.com/storybookjs/storybook/discussions/32423
      control: false,
      description: "Elements to display in grid",
    },
    className: { control: false, description: "Override styles" },
  },
  args: {
    cols: 2,
    spacing: "md",
    children: Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="bg-text h-12 min-w-12 rounded-md" />
    )),
  },
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */

export const Default: Story = {};

export const CustomColumns: Story = {
  argTypes: { cols: { control: "object" } },
  args: { cols: ["max-content", "1fr", "2fr"] },
};
