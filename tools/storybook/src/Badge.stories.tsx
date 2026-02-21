import type { Meta } from "@storybook/react-vite";
import { Badge } from "@/components/ui/badge";

const meta: Meta = {
  title: "Components/Badge",
  parameters: { layout: "padded" },
};

export default meta;

export const StatusBadges = () => (
  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
    <Badge variant="outline" className="border-emerald-800 bg-emerald-950 text-emerald-300">
      done
    </Badge>
    <Badge variant="outline" className="border-red-800 bg-red-950 text-red-300">
      failed
    </Badge>
    <Badge variant="outline" className="border-blue-800 bg-blue-950 text-blue-300">
      running
    </Badge>
    <Badge variant="outline" className="border-amber-800 bg-amber-950 text-amber-300">
      pending
    </Badge>
  </div>
);
