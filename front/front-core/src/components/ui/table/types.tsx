// =========================
// file: src/types/orders.ts
// -------------------------
export type Order = {
  id: number;
  header: string;
  type: string;
  status: string;
  target: string;
  limit: string;
  reviewer: string;
  model_name?: string;
  printing_type?: string;
  quantity?: string | number;
  weight_per_item?: string | number;
  material?: string;
};

// =========================
// file: src/constants/charts.ts
// ----------------------------
/**
 * Keeps demo data and chart colour config out of the presentation layer.
 */
export const chartData:any = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
] as const;

export const chartConfig = {
  desktop: { label: "Desktop", color: "var(--primary)" },
  mobile: { label: "Mobile", color: "var(--primary)" },
} as const;

// =========================
// file: src/components/DragHandle.tsx
// -----------------------------------
import { Button } from "../button";
import { IconGripVertical } from "../../../icons-shim";
import { useSortable } from "@dnd-kit/sortable";
import { type UniqueIdentifier } from "@dnd-kit/core";

interface DragHandleProps {
  id: UniqueIdentifier;
}

export const DragHandle = ({ id }: DragHandleProps) => {
  const { attributes, listeners } = useSortable({ id });

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <IconGripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
};
