import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/controls';
import { cn } from '@/lib/cn';
import { getPageItems, PAGE_SIZES, type PageSize } from '../list-state';

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
}

export function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-rule px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <label htmlFor="page-size">Rows per page</label>
        <div className="w-20">
          <Select
            id="page-size"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <nav
        aria-label="Pagination"
        className="flex items-center justify-between gap-1 sm:justify-end"
      >
        <Button
          variant="ghost"
          size="sm"
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <p className="text-sm text-ink-soft tabular-nums sm:hidden">
          Page {page} of {totalPages}
        </p>

        <ul className="hidden items-center gap-1 sm:flex">
          {getPageItems(page, totalPages).map((item, index) =>
            item === 'gap' ? (
              <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-soft">
                …
              </li>
            ) : (
              <li key={item}>
                <Button
                  variant={item === page ? 'primary' : 'ghost'}
                  size="sm"
                  aria-current={item === page ? 'page' : undefined}
                  aria-label={`Page ${item}`}
                  onClick={() => onPageChange(item)}
                  className={cn(
                    'min-w-9 px-2 tabular-nums',
                    item === page && 'pointer-events-none',
                  )}
                >
                  {item}
                </Button>
              </li>
            ),
          )}
        </ul>

        <Button
          variant="ghost"
          size="sm"
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </nav>
    </div>
  );
}
