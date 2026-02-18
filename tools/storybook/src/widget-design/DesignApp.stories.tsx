import type { Meta, StoryObj } from "@storybook/react";
import DesignApp from "./DesignApp";

const meta: Meta = {
  title: "Widget",
  component: DesignApp as any,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

export const Playground: Story = {};
