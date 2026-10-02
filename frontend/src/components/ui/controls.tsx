import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

// Inputs use 16px text on small screens so iOS Safari doesn't zoom on focus.
const CONTROL =
  'block w-full rounded-control border border-rule-strong bg-paper text-base text-ink sm:text-sm ' +
  'placeholder:text-ink-soft/75 hover:border-ink-soft focus:border-pen focus:outline-none focus:ring-3 focus:ring-pen/20 ' +
  'aria-[invalid=true]:border-overdue aria-[invalid=true]:focus:ring-overdue/20 disabled:cursor-not-allowed disabled:bg-desk';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, 'min-h-11 px-3 sm:min-h-10', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-24 px-3 py-2', className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          CONTROL,
          'min-h-11 cursor-pointer appearance-none pr-9 pl-3 sm:min-h-10',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-soft"
      />
    </div>
  );
}
