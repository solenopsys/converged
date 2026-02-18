// =========================
// file: src/types/orders.ts
// -------------------------
import { z } from "zod";

/**
 * Central place for all row‑level data types used by the orders UI.
 */
export const orderSchema = z.object({
  id: z.number(),
  header: z.string(),
  type: z.string(),
  status: z.string(),
  target: z.string(),
  limit: z.string(),
  reviewer: z.string(),
  model_name: z.string().optional(),
  printing_type: z.string().optional(),
  quantity: z.union([z.string(), z.number()]).optional(),
  weight_per_item: z.union([z.string(), z.number()]).optional(),
  material: z.string().optional(),
});

export type Order = z.infer<typeof orderSchema>;

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
import { IconGripVertical } from "@tabler/icons-react";
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
