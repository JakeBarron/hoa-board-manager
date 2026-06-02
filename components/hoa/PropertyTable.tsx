"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Property } from "@/types/database";

const col = createColumnHelper<Property>();

// Large sentinel used when the user selects "All"
const ALL_PAGE_SIZE = 9999;
const PAGE_SIZE_OPTIONS = [
  { label: "10", value: 10 },
  { label: "25", value: 25 },
  { label: "50", value: 50 },
  { label: "All", value: ALL_PAGE_SIZE },
];

const buildColumns = (onLotClick?: (lotNumber: number) => void) => [
  col.accessor("lot_number", {
    header: "Lot #",
    cell: (info) =>
      onLotClick ? (
        <button
          className="font-medium underline-offset-2 hover:underline text-foreground"
          onClick={() => onLotClick(info.getValue())}
          aria-label={String(info.getValue())}
        >
          {info.getValue()}
        </button>
      ) : (
        <span className="font-medium">{info.getValue()}</span>
      ),
  }),
  col.accessor("last_name", {
    header: "Last Name",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("first_name", {
    header: "First Name",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("street_address", {
    header: "Street Address",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("membership", {
    header: "Membership",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("membership_type", {
    header: "Type",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("annual_lease_fee", {
    header: "Annual Lease Fee",
    cell: (info) => {
      const fee = info.getValue();
      if (fee != null) return `$${fee.toFixed(2)}`;
      if (info.row.original.has_annual_lease_fee) return "Yes";
      return "—";
    },
  }),
  col.accessor("sayor", {
    header: "SAYOR",
    cell: (info) => (info.getValue() ? "Yes" : "No"),
  }),
  col.accessor("key_fob_1", {
    header: "Key Fob 1",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("key_fob_2", {
    header: "Key Fob 2",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("email_1", {
    header: "Email 1",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("email_2", {
    header: "Email 2",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("account_number", {
    header: "Account #",
    cell: (info) => info.getValue() ?? "—",
  }),
];

/** Props for {@link PropertyTable}. */
interface PropertyTableProps {
  /** Pre-filtered list of properties to display. */
  lots: Property[];
  /**
   * Optional callback invoked with the lot_number when the lot # cell is clicked.
   * When omitted the lot # renders as plain text.
   */
  onLotClick?: (lotNumber: number) => void;
}

/**
 * Sortable, paginated property table using TanStack Table.
 * Receives a pre-filtered `lots` array — all filtering is done upstream.
 * Default sort is lot_number ascending; default page size is 25.
 */
export function PropertyTable({ lots, onLotClick }: PropertyTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lot_number", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const table = useReactTable({
    data: lots,
    columns: buildColumns(onLotClick),
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: true,
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;
  const firstRow = pageSize >= ALL_PAGE_SIZE ? 1 : pageIndex * pageSize + 1;
  const lastRow = pageSize >= ALL_PAGE_SIZE ? totalRows : Math.min((pageIndex + 1) * pageSize, totalRows);

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.getCanSort() ? "cursor-pointer select-none" : ""}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" && " ↑"}
                  {header.column.getIsSorted() === "desc" && " ↓"}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination controls */}
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>
          {totalRows === 0
            ? "No results"
            : `${firstRow}–${lastRow} of ${totalRows}`}
        </span>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) =>
              setPagination({ pageIndex: 0, pageSize: Number(v) })
            }
          >
            <SelectTrigger className="w-20 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map(({ label, value }) => (
                <SelectItem key={value} value={String(value)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            ←
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
