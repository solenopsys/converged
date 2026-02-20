import type { Meta } from "@storybook/react-vite";
import { Badge } from "@/components/ui/badge";

const meta: Meta = {
  title: "Components/Badge",
  parameters: { layout: "padded" },
};

export default meta;

export const StatusBadges = () => (
  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
    <Badge variant="success">done</Badge>
    <Badge variant="destructive">failed</Badge>
    <Badge variant="secondary">running</Badge>
    <Badge variant="outline">pending</Badge>
  </div>
);
