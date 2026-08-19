import { streamlineIcons } from "./streamline-icons";
import type { V2SymbolKind } from "./types";

export const streamlineIconByKind: Record<V2SymbolKind, string> = {
  smartphone: "streamline:phone-mobile-phone",
  gateway: "streamline:computer-connection-network-network-server-internet-ethernet",
  processor: "streamline:computer-chip-2",
  recipient: "streamline:interface-user-circle-circle-geometric-human-person-single-user",
  storage: "streamline:database-server-1",
  stream: "streamline:programming-rss-symbol-wireless-feed-rss-transmit-broadcast",
  message: "streamline:chat-bubble-text-square",
  channel: "streamline:mail-incoming",
};

export const streamlineCogIcon = "streamline:cog";
const fallbackIcon = streamlineIcons["computer-chip-2"];

export function getStreamlineIcon(icon: string) {
  const name = icon.replace("streamline:", "");
  const data = streamlineIcons[name as keyof typeof streamlineIcons] ?? fallbackIcon;

  return {
    body: data.body,
    height: data.height,
    width: data.width,
  };
}
