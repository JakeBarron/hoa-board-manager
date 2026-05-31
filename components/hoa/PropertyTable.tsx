"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { Property } from "@/types/database";

const col = createColumnHelper<Property>();

const buildColumns = (onLotClick: (lotNumber: number) => void) => [
  col.accessor("lot_number", {
    header: "Lot #",
    cell: (info) => (
      <button
        className="font-medium underline-offset-2 hover:underline text-foreground"
        onClick={() => onLotClick(info.getValue())}
        aria-label={String(info.getValue())}
      >
        {info.getValue()}
      </button>
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
  col.accessor("membership_type", {
    header: "Membership Type",
    cell: (info) => info.getValue() ?? "—",
  }),
  col.accessor("annual_lease_fee", {
    header: "Annual Lease Fee",
    cell: (info) => {
      const v = info.getValue();
      return v != null ? `$${v.toFixed(2)}` : "—";
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
  /** Called with the lot_number when the lot # cell button is clicked. */
  onLotClick: (lotNumber: number) => void;
}

/**
 * Sortable property table using TanStack Table.
 * Receives a pre-filtered `lots` array — all filtering is done upstream in MapView.
 * Default sort is lot_number ascending (matches server fetch order).
 *
 * @param props.lots - Pre-filtered list of properties to render.
 * @param props.onLotClick - Callback invoked with the lot_number when the lot # button is clicked.
 */
export function PropertyTable({ lots, onLotClick }: PropertyTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "lot_number", desc: false },
  ]);

  const table = useReactTable({
    data: lots,
    columns: buildColumns(onLotClick),
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
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
  );
}
