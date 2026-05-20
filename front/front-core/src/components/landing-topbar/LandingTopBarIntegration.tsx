import { useState } from "react";
import { useUnit } from "effector-react";
import { chatSendRequested, chatAttachRequested } from "../../chat/events";
import { LandingTopBar, type LandingTopBarProps } from "./LandingTopBar";

type IntegrationProps = Omit<LandingTopBarProps, "value" | "onValueChange" | "onSubmit" | "onAttach">;

export function LandingTopBarIntegration(props: IntegrationProps) {
  const [value, setValue] = useState("");
  const sendMessage = useUnit(chatSendRequested);
  const attachFile = useUnit(chatAttachRequested);

  return (
    <LandingTopBar
      {...props}
      value={value}
      onValueChange={setValue}
      onSubmit={(text) => {
        sendMessage(text);
        setValue("");
      }}
      onAttach={() => attachFile()}
    />
  );
}
