import { useState } from "react";
import { useUnit } from "effector-react";
import { chatSendRequested, chatAttachRequested } from "../../chat/events";
import { ConvergedRailPanel, type ConvergedRailPanelProps } from "./ConvergedRailPanel";

type IntegrationProps = Omit<ConvergedRailPanelProps, "composerValue" | "onComposerChange" | "onComposerSubmit" | "onComposerAttach">;

export function ConvergedRailPanelIntegration(props: IntegrationProps) {
  const [value, setValue] = useState("");
  const sendMessage = useUnit(chatSendRequested);
  const attachFile = useUnit(chatAttachRequested);

  return (
    <ConvergedRailPanel
      {...props}
      composerValue={value}
      onComposerChange={setValue}
      onComposerSubmit={() => {
        const text = value.trim();
        if (!text) return;
        sendMessage(text);
        setValue("");
      }}
      onComposerAttach={() => attachFile()}
    />
  );
}
