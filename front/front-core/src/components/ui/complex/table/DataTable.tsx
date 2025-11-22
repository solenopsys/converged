import React from "react";
import {
  DndContext,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useOrderColumns } from "./columns"; // Fixed import
import { type Order } from "./types";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { IconChevronsLeft, IconChevronLeft, IconChevronRight, IconChevronsRight, IconChevronDown, IconLayoutColumns } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label"; 
import { useSortable } from "@dnd-kit/sortable";
import { useTranslation } from "node_modules/react-i18next";
 

interface DataTableProps {
  data: Order[];
}

export const DataTable: React.FC<DataTableProps> = ({ data: initialData }) => {
  const { i18n } = useTranslation("table_titles");
  
  // Безопасное получение данных
  const getTitles = () => {
    if (i18n.options && i18n.options.resources) {
      const lang = i18n.language || 'en';
      return i18n.options.resources[lang].table_titles || {};
    }
    return {};
  };

  const texts:any = getTitles();

  // Get columns from the hook
  const { orderColumns } = useOrderColumns();

  const [data, setData] = React.useState(initialData);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [sorting, setSorting] = React.useState([]);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });

  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor), useSensor(KeyboardSensor));
  const rowIds = React.useMemo(() => data.map((r) => r.id), [data]);

  const table = useReactTable({
    data,
    columns: orderColumns,
    state: { rowSelection, columnVisibility, sorting, pagination },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getRowId: (row) => row.id.toString(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (active && over && active.id !== over.id) {
      setData((cur) => {
        const oldIdx = rowIds.indexOf(active.id as number);
        const newIdx = rowIds.indexOf(over.id as number);
        return arrayMove(cur, oldIdx, newIdx);
      });
    }
  };

  return (
    <Tabs defaultValue="outline" className="flex flex-col gap-6">
      {/* --- header --- */}
      <div className="flex items-center justify-between px-4 lg:px-6">
        <TabsList className="hidden @4xl/main:flex">
          <TabsTrigger value="outline">{texts.tabs?.outline || 'Статусы заказов'}</TabsTrigger>
          <TabsTrigger value="in-progress">
            {texts.tabs?.in_progress || 'В процессе'} <Badge variant="secondary">{texts.status?.count?.in_progress || '4'}</Badge>
          </TabsTrigger>
          <TabsTrigger value="done">
            {texts.tabs?.done || 'Готовые'} <Badge variant="secondary">{texts.status?.count?.done || '6'}</Badge>
          </TabsTrigger>
        </TabsList>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <IconLayoutColumns />
              <span className="hidden lg:inline">{texts.table?.columns_dropdown || 'Колонки'}</span>
              <IconChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {table
              .getAllColumns()
              .filter((c) => typeof c.accessorFn !== "undefined" && c.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(!!v)}
                >
                  {column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* --- table --- */}
      <TabsContent value="outline" className="px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <DndContext modifiers={[restrictToVerticalAxis]} collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
                    {table.getRowModel().rows.map((row) => (
                      <SortableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell colSpan={orderColumns.length} className="h-24 text-center">
                      {texts.table?.no_results || 'Нет результатов.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        {/* Пример реализации пагинации с локализацией */}
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {texts.table?.selection_summary 
              ? texts.table.selection_summary
                .replace('{selected}', table.getFilteredSelectedRowModel().rows.length.toString())
                .replace('{total}', table.getFilteredRowModel().rows.length.toString())
              : `${table.getFilteredSelectedRowModel().rows.length} из ${table.getFilteredRowModel().rows.length} строк выбрано.`}
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">{texts.table?.pagination?.page_size || 'Строк на странице'}</p>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              {texts.table?.page_info 
                ? texts.table.page_info
                  .replace('{current}', (table.getState().pagination.pageIndex + 1).toString())
                  .replace('{total}', table.getPageCount().toString())
                : `Страница ${table.getState().pagination.pageIndex + 1} ${texts.table?.pagination?.of || 'из'} ${table.getPageCount()} ${texts.table?.pagination?.pages || 'страниц'}`}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label={texts.table?.pagination?.first || 'Первая'}
              >
                <IconChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label={texts.table?.pagination?.previous || 'Предыдущая'}
              >
                <IconChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label={texts.table?.pagination?.next || 'Следующая'}
              >
                <IconChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                aria-label={texts.table?.pagination?.last || 'Последняя'}
              >
                <IconChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* other tabs stub */}
      <TabsContent value="in-progress" className="px-4 lg:px-6" />
      <TabsContent value="done" className="px-4 lg:px-6" />
    </Tabs>
  );
};

// --- separate component to keep DataTable lean ---
const SortableRow: React.FC<{ row: any }> = ({ row }) => {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id: row.original.id });

  return (
    <TableRow
      ref={setNodeRef}
      data-state={row.getIsSelected() && "selected"}
      data-dragging={isDragging}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
      ))}
    </TableRow>
  );
};