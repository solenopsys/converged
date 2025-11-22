import { 
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { IconChevronDown, IconLayoutColumns } from "@tabler/icons-react";
import {
  IconCircleCheckFilled,
  IconLoader,
  IconDotsVertical,
} from "@tabler/icons-react";
import {
  type ColumnDef,
  flexRender,
} from "@tanstack/react-table";

import { DragHandle, orderSchema, type Order } from "./types";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useTranslation } from "node_modules/react-i18next";

export function useOrderColumns() {
  const { t, i18n } = useTranslation("table_titles");
  
  // Получаем тексты непосредственно через функцию t
  const texts = {
    columns: {
      model_name: t("columns.model_name"),
      printing_type: t("columns.printing_type"),
      status: t("columns.status"),
      quantity: t("columns.quantity"),
      weight_per_item: t("columns.weight_per_item"),
      material: t("columns.material")
    },
    status: {
      completed: t("status.completed")
    },
    actions: {
      select_all: t("actions.select_all"),
      select_row: t("actions.select_row"),
      menu: t("actions.menu"),
      edit: t("actions.edit"),
      duplicate: t("actions.duplicate"),
      favorite: t("actions.favorite"),
      delete: t("actions.delete")
    },
    notifications: {
      saving: t("notifications.saving"),
      success: t("notifications.success"),
      error: t("notifications.error")
    },
    material: {
      select_placeholder: t("material.select_placeholder"),
      options: t("material.options", { returnObjects: true }) as string[]
    }
  };
  
  // Экспортируем материалы из переводов
  const materialOptions = texts.material.options;
  
  const orderColumns: ColumnDef<Order>[] = [
    {
      id: "drag",
      header: () => null,
      cell: ({ row }) => <DragHandle id={row.original.id} />,
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={(
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          ) as boolean}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label={texts.actions.select_all}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label={texts.actions.select_row}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "model_name",
      header: texts.columns.model_name,
      cell: ({ row }) => <span className="font-medium">{row.original.model_name}</span>,
      enableHiding: false,
    },
    {
      accessorKey: "printing_type",
      header: texts.columns.printing_type,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-muted-foreground px-1.5 w-32 truncate">
          {row.original.printing_type}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: texts.columns.status,
      cell: ({ row }) => (
        <Badge variant="outline" className="text-muted-foreground px-1.5 gap-1 inline-flex items-center">
          {row.original.status === texts.status.completed ? (
            <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
          ) : (
            <IconLoader />
          )}
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "quantity",
      header: () => <div className="text-right">{texts.columns.quantity}</div>,
      cell: ({ row }) => (
        <EditableNumberCell id={row.original.id} field="quantity" defaultValue={row.original.quantity} texts={texts} />
      ),
    },
    {
      accessorKey: "weight_per_item",
      header: () => <div className="text-right">{texts.columns.weight_per_item}</div>,
      cell: ({ row }) => (
        <EditableNumberCell id={row.original.id} field="weight_per_item" defaultValue={row.original.weight_per_item} texts={texts} />
      ),
    },
    {
      accessorKey: "material",
      header: texts.columns.material,
      cell: ({ row }) => {
        const { material } = row.original;
        if (material && materialOptions.includes(material as string)) return material;
        return <MaterialSelect id={row.original.id} texts={texts} materialOptions={materialOptions} />;
      },
    },
    {
      id: "actions",
      cell: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground size-8 data-[state=open]:bg-muted">
              <IconDotsVertical />
              <span className="sr-only">{texts.actions.menu}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem>{texts.actions.edit}</DropdownMenuItem>
            <DropdownMenuItem>{texts.actions.duplicate}</DropdownMenuItem>
            <DropdownMenuItem>{texts.actions.favorite}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">{texts.actions.delete}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  // ----- helpers used inside column defs -----
  const EditableNumberCell = ({ 
    id, 
    field, 
    defaultValue, 
    texts 
  }: { 
    id: number; 
    field: string; 
    defaultValue: unknown;
    texts: any; 
  }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        toast.promise(new Promise((r) => setTimeout(r, 1000)), {
          loading: texts.notifications.saving.replace('{id}', id.toString()),
          success: texts.notifications.success,
          error: texts.notifications.error,
        });
      }}
    >
      <Label htmlFor={`${id}-${field}`} className="sr-only">
        {field}
      </Label>
      <Input
        id={`${id}-${field}`}
        defaultValue={defaultValue as string | number}
        className="h-8 w-16 border-transparent bg-transparent text-right hover:bg-input/30 focus-visible:border focus-visible:bg-background dark:focus-visible:bg-input/30"
      />
    </form>
  );

  const MaterialSelect = ({ 
    id, 
    texts, 
    materialOptions 
  }: { 
    id: number; 
    texts: any; 
    materialOptions: string[] 
  }) => (
    <Select>
      <SelectTrigger id={`${id}-material`} size="sm" className="w-38 data-[slot=select-value]:truncate">
        <SelectValue placeholder={texts.material.select_placeholder} />
      </SelectTrigger>
      <SelectContent align="end">
        {materialOptions.map((m) => (
          <SelectItem key={m} value={m}>
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  
  return { orderColumns, materialOptions };
}
      