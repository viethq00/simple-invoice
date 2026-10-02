import { cn } from '@/lib/cn';

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-ink', className)}>
      <svg aria-hidden="true" viewBox="0 0 20 24" className="h-6 w-5 shrink-0">
        <path
          d="M2 1.5h11l5 5V22a.5.5 0 0 1-.5.5h-15A.5.5 0 0 1 2 22z"
          fill="#fff"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M13 1.5v5h5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5.5 12h9M5.5 15.5h9" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5.5 19h5" stroke="var(--color-pen)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="font-display text-lg leading-none">SimpleInvoice</span>
    </span>
  );
}
