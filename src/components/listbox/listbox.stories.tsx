import { Meta, StoryObj } from "@storybook/react";

import ListBoxItem from "../listbox-item/listbox-item";

import ListBox from "./listbox";

const meta = {
  args: {
    className: "w-[180px]",
    selectionMode: "single",
  },
  component: ListBox,
  parameters: {
    controls: { disable: true },
    layout: "centered",
  },
  title: "ListBox",
} satisfies Meta<typeof ListBox>;

export default meta;
type Story = StoryObj<typeof meta>;

/* --------------------------------- Stories -------------------------------- */
export const Default: Story = {
  args: {
    "aria-label": "Milkshake flavor",
    children: (
      <>
        <ListBoxItem textValue="Chocolate">Chocolate</ListBoxItem>
        <ListBoxItem textValue="Strawberry">Strawberry</ListBoxItem>
      </>
    ),
  },
};

export const Compact: Story = {
  args: {
    "aria-label": "Milkshake flavor",
    children: (
      <>
        <ListBoxItem textValue="Chocolate" compact>
          Chocolate
        </ListBoxItem>
        <ListBoxItem textValue="Strawberry" compact>
          Strawberry
        </ListBoxItem>
      </>
    ),
  },
};

export const Empty: Story = {};
