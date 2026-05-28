"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type Column<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  /** Optional value extractor for sorting; if omitted, column is unsortable. */
  sortValue?: (row: T) => number | string;
  align?: "left" | "right" | "center";
  width?: string | number;
  className?: string;
  headerClassName?: string;
};

type SortState = { id: string; dir: "asc" | "desc" } | null;

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T, index: number) => void;
  initialSort?: SortState;
  className?: string;
  rowClassName?: (row: T, index: number) => string | undefined;
  empty?: React.ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  initialSort = null,
  className,
  rowClassName,
  empty,
}: Props<T>) {
  const [sort, setSort] = React.useState<SortState>(initialSort);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col || !col.sortValue) return rows;
    const get = col.sortValue;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * sign;
      }
      return String(va).localeCompare(String(vb)) * sign;
    });
  }, [rows, sort, columns]);

  const toggleSort = (id: string) => {
    setSort((prev) => {
      if (!prev || prev.id !== id) return { id, dir: "desc" };
      if (prev.dir === "desc") return { id, dir: "asc" };
      return null;
    });
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elev-1)]",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
              {columns.map((c) => {
                const sortable = !!c.sortValue;
                const active = sort?.id === c.id;
                const Icon = active
                  ? sort?.dir === "asc"
                    ? ChevronUp
                    : ChevronDown
                  : ChevronsUpDown;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={
                      sortable
                        ? active
                          ? sort?.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className={cn(
                      "px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-muted)]",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.align !== "right" && c.align !== "center" && "text-left",
                      c.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.id)}
                        aria-label={
                          active
                            ? `Sort by ${typeof c.header === "string" ? c.header : c.id} (${sort?.dir === "asc" ? "ascending" : "descending"})`
                            : `Sort by ${typeof c.header === "string" ? c.header : c.id}`
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]",
                          active && "text-[var(--color-accent)]",
                        )}
                      >
                        <span>{c.header}</span>
                        <Icon size={11} aria-hidden className="opacity-70" />
                      </button>
                    ) : (
                      <span>{c.header}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-[var(--color-text-muted)]"
                >
                  {empty ?? "No data."}
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr
                  key={rowKey(row, i)}
                  className={cn(
                    "border-b border-[var(--color-border)] last:border-b-0 transition-colors",
                    onRowClick && "cursor-pointer hover:bg-[var(--color-bg-elev-2)]",
                    rowClassName?.(row, i),
                  )}
                  onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                >
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        "px-4 py-3 align-middle text-[var(--color-text)]",
                        c.align === "right" && "text-right",
                        c.align === "center" && "text-center",
                        c.className,
                      )}
                    >
                      {c.cell(row, i)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
