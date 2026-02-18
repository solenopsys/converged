import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "PublicBlocks",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

export const Empty: Story = {
  render: () => null,
};
