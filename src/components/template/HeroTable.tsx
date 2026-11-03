import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface HeroTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /**
   * Field identifier passed to onSort when column header is clicked.
   * If omitted, the column header will not be clickable.
   */
  sortField?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  titleTooltip?: string;
  /**
   * Cell renderer for each row item.
   */
  render: (item: T, index: number, isLowSample: boolean) => React.ReactNode;
}

export interface HeroTableProps<T> {
  /**
   * Primary dataset (or representative data when lowSampleData is passed separately).
   */
  data: T[];
  /**
   * Optional pre-partitioned low sample dataset.
   */
  lowSampleData?: T[];
  /**
   * Predicate to determine if an item is considered low sample.
   * Used when lowSampleData is omitted.
   */
  isLowSample?: (item: T) => boolean;

  /**
   * Column definitions.
   */
  columns: HeroTableColumn<T>[];

  /**
   * Unique key extractor for React list keys.
   */
  getRowKey: (item: T, index: number) => string | number;

  /**
   * Active sort field.
   */
  sortField?: string;
  /**
   * Sort order: true for ascending, false for descending.
   */
  sortAsc?: boolean;
  /**
   * Callback invoked when clicking on a sortable column header.
   */
  onSort?: (field: string) => void;

  /**
   * Match count threshold below which data is considered statistically inconclusive.
   */
  threshold?: number;
  /**
   * Whether to display the dashed delimiter banner separating representative and low sample data.
   * Defaults to true.
   */
  showThresholdDelimiter?: boolean;
  /**
   * Custom delimiter banner message node.
   */
  thresholdMessage?: React.ReactNode;
  /**
   * Whether to group/separate low sample rows at the bottom after the delimiter banner.
   * Defaults to true if lowSampleData is provided or threshold delimiter is active.
   */
  separateLowSample?: boolean;

  /**
   * Top toolbar slot for table-specific controls (mode tabs, search input, filters, extra badges).
   */
  headerContent?: React.ReactNode;

  /**
   * Custom row CSS class generator.
   */
  rowClassName?: (item: T, isLowSample: boolean, index: number) => string;
  /**
   * Custom row tooltip text generator.
   */
  rowTitle?: (item: T, isLowSample: boolean, index: number) => string | undefined;
  /**
   * Row click callback.
   */
  onRowClick?: (item: T, isLowSample: boolean) => void;

  /**
   * Optional custom row renderer if a table requires full control over the <tr> element.
   */
  renderRow?: (item: T, isLowSample: boolean, index: number) => React.ReactNode;

  /**
   * Message shown when there are zero rows.
   */
  emptyMessage?: React.ReactNode;

  /**
   * Container className.
   */
  className?: string;
  /**
   * Table className.
   */
  tableClassName?: string;
}

export function HeroTable<T>({
  data,
  lowSampleData,
  isLowSample,
  columns,
  getRowKey,
  sortField,
  sortAsc = false,
  onSort,
  threshold,
  showThresholdDelimiter = true,
  thresholdMessage,
  separateLowSample = true,
  headerContent,
  rowClassName,
  rowTitle,
  onRowClick,
  renderRow,
  emptyMessage = 'No entries found matching your criteria.',
  className = '',
  tableClassName = '',
}: HeroTableProps<T>) {
  // Partition dataset into representative and low-sample groups
  const { repItems, lowItems, totalCount } = React.useMemo(() => {
    if (lowSampleData !== undefined) {
      return {
        repItems: data,
        lowItems: lowSampleData,
        totalCount: data.length + lowSampleData.length,
      };
    }

    if (isLowSample && separateLowSample) {
      const rep: T[] = [];
      const low: T[] = [];
      for (const item of data) {
        if (isLowSample(item)) {
          low.push(item);
        } else {
          rep.push(item);
        }
      }
      return {
        repItems: rep,
        lowItems: low,
        totalCount: data.length,
      };
    }

    // Single unified list (not separated)
    return {
      repItems: data,
      lowItems: [],
      totalCount: data.length,
    };
  }, [data, lowSampleData, isLowSample, separateLowSample]);

  const renderSingleRow = (item: T, isLow: boolean, index: number) => {
    if (renderRow) {
      return renderRow(item, isLow, index);
    }

    const key = getRowKey(item, index);
    const computedClass = rowClassName
      ? rowClassName(item, isLow, index)
      : `transition-all duration-200 ${
          isLow
            ? 'opacity-40 blur-[1px] hover:blur-none hover:opacity-100 bg-deadlock-card/20 hover:bg-deadlock-card/60'
            : 'hover:bg-deadlock-card/50'
        } ${onRowClick ? 'cursor-pointer' : ''}`;

    const computedTitle = rowTitle
      ? rowTitle(item, isLow, index)
      : isLow
      ? `Low sample size (${threshold != null ? `< ${threshold} matches` : ''}) — hover to reveal`
      : undefined;

    return (
      <tr
        key={key}
        className={computedClass}
        title={computedTitle}
        onClick={onRowClick ? () => onRowClick(item, isLow) : undefined}
      >
        {columns.map((col) => {
          const alignClass =
            col.align === 'right'
              ? 'text-right'
              : col.align === 'center'
              ? 'text-center'
              : 'text-left';

          return (
            <td
              key={col.key}
              className={`py-3 px-4 ${alignClass} ${col.className ?? ''}`}
            >
              {col.render(item, index, isLow)}
            </td>
          );
        })}
      </tr>
    );
  };

  const hasLowSample = lowItems.length > 0;
  const shouldRenderDelimiter = showThresholdDelimiter && hasLowSample;

  return (
    <div className={`steam-glass steam-panel rounded-xl overflow-hidden flex flex-col ${className}`}>
      {/* Table Toolbar / Header Slot */}
      {headerContent && (
        <div className="p-4 border-b border-deadlock-border/80">
          {headerContent}
        </div>
      )}

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className={`w-full text-left text-xs ${tableClassName}`}>
          {/* Header Row */}
          <thead className="bg-deadlock-card/90 text-deadlock-muted border-b border-deadlock-border/60">
            <tr>
              {columns.map((col) => {
                const isSortable = Boolean(col.sortField && onSort);
                const isCurrentSort = sortField === col.sortField;
                const alignClass =
                  col.align === 'right'
                    ? 'justify-end text-right'
                    : col.align === 'center'
                    ? 'justify-center text-center'
                    : 'justify-start text-left';

                return (
                  <th
                    key={col.key}
                    onClick={isSortable ? () => onSort?.(col.sortField!) : undefined}
                    title={col.titleTooltip}
                    className={`py-3 px-4 font-semibold select-none ${
                      isSortable ? 'cursor-pointer hover:text-deadlock-steam transition-colors' : ''
                    } ${col.headerClassName ?? ''}`}
                  >
                    <div className={`flex items-center gap-1 ${alignClass}`}>
                      <span>{col.header}</span>
                      {isSortable && isCurrentSort && (
                        sortAsc ? (
                          <ChevronUp className="w-3.5 h-3.5 text-deadlock-accent shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-deadlock-accent shrink-0" />
                        )
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-deadlock-border/40">
            {totalCount === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 text-center text-deadlock-muted italic"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              <>
                {/* Representative items (or all items if not separated) */}
                {repItems.map((item, idx) => {
                  const isLow = isLowSample && !separateLowSample ? isLowSample(item) : false;
                  return renderSingleRow(item, isLow, idx);
                })}

                {/* Delimiter Row for Low-Sample threshold */}
                {shouldRenderDelimiter && (
                  <tr className="bg-deadlock-dark/95 border-y border-dashed border-amber-500/40">
                    <td colSpan={columns.length} className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-xs text-amber-200/90 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                        <span>
                          {thresholdMessage ?? (
                            <>
                              Low Sample Size {threshold != null ? `(< ${threshold} matches)` : ''} — The following heroes do not have enough data to be statistically conclusive
                            </>
                          )}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
                      </div>
                    </td>
                  </tr>
                )}

                {/* Low-sample items */}
                {lowItems.map((item, idx) => renderSingleRow(item, true, repItems.length + idx))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
