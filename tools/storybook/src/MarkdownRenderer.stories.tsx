import type { Meta, StoryObj } from "@storybook/react-vite";
import { MarkdownRenderer } from "md-tools/markdown-renderer";

const meta = {
  title: "Components/MarkdownRenderer",
  component: MarkdownRenderer,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MarkdownRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Heading: Story = {
  args: {
    ast: {
      type: "root",
      children: [
        { type: "heading", details: { level: 1 }, children: [{ type: "text", text: "Hello World" }] },
        { type: "paragraph", children: [{ type: "text", text: "This is a paragraph." }] },
      ],
    },
  },
};

export const List: Story = {
  args: {
    ast: {
      type: "root",
      children: [
        {
          type: "list",
          children: [
            { type: "listItem", children: [{ type: "text", text: "Item 1" }] },
            { type: "listItem", children: [{ type: "text", text: "Item 2" }] },
            { type: "listItem", children: [{ type: "text", text: "Item 3" }] },
          ],
        },
      ],
    },
  },
};

export const CodeBlock: Story = {
  args: {
    ast: {
      type: "root",
      children: [
        { type: "code_block", text: "const x = 42;\nconsole.log(x);" },
      ],
    },
  },
};
