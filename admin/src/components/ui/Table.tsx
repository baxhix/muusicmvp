'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IconArrowUp, IconChevronLeft, IconChevronRight } from '@/components/icons';
import Checkbox from './Checkbox';
import Button from './Button';
import styles from './Table.module.css';

export interface Column<T> {
  id: string;
  header: ReactNode;
  /** how to render the cell */
  cell: (row: T, index: number) => ReactNode;
  /** value used for sorting (number or string). Omit to disable sort. */
  sortKey?: (row: T) => string | number;
  width?: string | number;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowId?: (row: T) => string;
  /** selection */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** click on row */
  onRowClick?: (row: T) => void;
  /** UI extensions */
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  bulkActions?: ReactNode;
  /** pagination */
  pageSize?: number;
  /** state */
  loading?: boolean;
  emptyState?: ReactNode;
}

type SortState = { id: string; dir: 'asc' | 'desc' } | null;

export default function Table<T>({
  columns,
  data,
  rowId,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
  toolbarLeft,
  toolbarRight,
  bulkActions,
  pageSize = 10,
  loading = false,
  emptyState,
}: TableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);

  const getId = (row: T, idx: number): string =>
    rowId ? rowId(row) : String(idx);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortKey) return data;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = col.sortKey!(a);
      const bv = col.sortKey!(b);
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
  }, [data, columns, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const allVisibleIds = visible.map((r, i) => getId(r, start + i));
  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id));
  const someSelected =
    allVisibleIds.some((id) => selectedIds.includes(id)) && !allSelected;

  function toggleAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !allVisibleIds.includes(id)));
    } else {
      onSelectionChange(Array.from(new Set([...selectedIds, ...allVisibleIds])));
    }
  }

  function toggleRow(id: string) {
    if (!onSelectionChange) return;
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  }

  function handleSort(col: Column<T>) {
    if (!col.sortKey) return;
    setSort((prev) => {
      if (!prev || prev.id !== col.id) return { id: col.id, dir: 'asc' };
      if (prev.dir === 'asc') return { id: col.id, dir: 'desc' };
      return null;
    });
  }

  return (
    <div className={styles.tableWrap}>
      {(toolbarLeft || toolbarRight) && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>{toolbarLeft}</div>
          <div className={styles.toolbarRight}>{toolbarRight}</div>
        </div>
      )}

      {selectable && selectedIds.length > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>
            {selectedIds.length} selecionado{selectedIds.length === 1 ? '' : 's'}
          </span>
          {bulkActions}
        </div>
      )}

      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            {selectable && (
              <th className={cn(styles.th, styles.checkboxCol)}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </th>
            )}
            {columns.map((col) => {
              const active = sort?.id === col.id;
              return (
                <th
                  key={col.id}
                  className={cn(
                    styles.th,
                    col.sortKey && styles.thSortable,
                    active && sort.dir === 'asc' && styles.thActiveAsc,
                    active && sort.dir === 'desc' && styles.thActiveDesc,
                    col.className
                  )}
                  style={{
                    width: col.width,
                    textAlign: col.align,
                  }}
                  onClick={() => handleSort(col)}
                >
                  <span className={styles.thInner}>
                    {col.header}
                    {col.sortKey && (
                      <span className={styles.sortIndicator}>
                        <IconArrowUp size={12} />
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {loading ? (
            <tr>
              <td className={styles.td} colSpan={columns.length + (selectable ? 1 : 0)}>
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-mute)', fontSize: 12.5 }}>
                  Carregando...
                </div>
              </td>
            </tr>
          ) : visible.length === 0 ? (
            <tr>
              <td className={styles.td} colSpan={columns.length + (selectable ? 1 : 0)}>
                {emptyState ?? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-mute)', fontSize: 12.5 }}>
                    Nenhum resultado.
                  </div>
                )}
              </td>
            </tr>
          ) : (
            visible.map((row, i) => {
              const id = getId(row, start + i);
              const selected = selectedIds.includes(id);
              return (
                <tr
                  key={id}
                  className={cn(
                    styles.row,
                    selected && styles.rowSelected,
                    onRowClick && styles.rowClickable
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selectable && (
                    <td
                      className={cn(styles.td, styles.checkboxCol)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selected}
                        onChange={() => toggleRow(id)}
                        aria-label="Selecionar linha"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(styles.td, col.className)}
                      style={{ textAlign: col.align }}
                    >
                      {col.cell(row, start + i)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {sorted.length > pageSize && (
        <div className={styles.pagination}>
          <span>
            {start + 1}–{Math.min(start + pageSize, sorted.length)} de {sorted.length}
          </span>
          <div className={styles.paginationActions}>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Página anterior"
            >
              <IconChevronLeft size={14} />
            </Button>
            <span style={{ fontSize: 12, color: 'var(--text-soft)', minWidth: 60, textAlign: 'center' }}>
              {safePage + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label="Próxima página"
            >
              <IconChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
