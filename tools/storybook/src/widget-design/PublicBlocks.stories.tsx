import type { Meta, StoryObj } from "@storybook/react";
import { type JSX } from "preact/jsx-runtime";
import DesignContainer from "./components/DesignContainer.tsx";
import CallButtonExample from "./examples/CallButtonExample.tsx";
import ProgressBarExample from "./examples/ProgressBarExample.tsx";
import ScrollBarExample from "./examples/ScrollBarExample.tsx";
import IconButtonExample from "./examples/IconButtonExample.tsx";
import ChatInputExample from "./examples/ChatInputExample.tsx";
import ChatContainerExample from "./examples/ChatContainerExample.tsx";
import MessageBubbleExample from "./examples/MessageBubbleExample.tsx";
import TypographyMarkdownExample from "./examples/TypographyMarkdownExample.tsx";
import FileViewExample from "./examples/FileViewExample.tsx";
import FileListExample from "./examples/FileListExample.tsx";

const meta: Meta = {
  title: "Widget",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj;

const sectionStyle: JSX.CSSProperties = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  boxShadow: "0 6px 18px rgba(0,0,0,0.07)",
  marginBottom: "24px",
  maxWidth: "440px",
};

const controlsStyle: JSX.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "16px",
  marginTop: "12px",
  alignItems: "center",
};

const badgeStyle: JSX.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  color: "#666",
};

const Frame = ({ children }: { children: JSX.Element | JSX.Element[] }) => (
  <DesignContainer>
    <header style={{ marginBottom: "32px" }}>
      <h1 style={{ fontSize: "28px", margin: 0 }}>Public Blocks</h1>
      <p style={{ marginTop: "8px", color: "#444", maxWidth: "640px" }}>
        Отдельные блоки из публичной страницы, без сборной витрины.
      </p>
    </header>
    {children}
  </DesignContainer>
);

export const CallButton: Story = {
  render: () => (
    <Frame>
      <CallButtonExample sectionStyle={sectionStyle} badgeStyle={badgeStyle} />
    </Frame>
  ),
};

export const ProgressBar: Story = {
  render: () => (
    <Frame>
      <ProgressBarExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
    </Frame>
  ),
};

export const ScrollBar: Story = {
  render: () => (
    <Frame>
      <ScrollBarExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
    </Frame>
  ),
};

export const IconButton: Story = {
  render: () => (
    <Frame>
      <IconButtonExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
    </Frame>
  ),
};

export const ChatInput: Story = {
  render: () => (
    <Frame>
      <ChatInputExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
    </Frame>
  ),
};

export const ChatContainer: Story = {
  render: () => (
    <Frame>
      <ChatContainerExample sectionStyle={sectionStyle} badgeStyle={badgeStyle} />
    </Frame>
  ),
};

export const MessageBubble: Story = {
  render: () => (
    <Frame>
      <MessageBubbleExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
    </Frame>
  ),
};

export const TypographyMarkdown: Story = {
  render: () => (
    <Frame>
      <TypographyMarkdownExample sectionStyle={sectionStyle} badgeStyle={badgeStyle} />
    </Frame>
  ),
};

export const FileView: Story = {
  render: () => (
    <Frame>
      <FileViewExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
    </Frame>
  ),
};

export const FileList: Story = {
  render: () => (
    <Frame>
      <FileListExample
        sectionStyle={sectionStyle}
        badgeStyle={badgeStyle}
        controlsStyle={controlsStyle}
      />
    </Frame>
  ),
};
