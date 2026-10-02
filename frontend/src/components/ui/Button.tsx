import type { ComponentProps } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'sm';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap select-none transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-[#24375e] active:bg-[#0e1930]',
  secondary:
    'border border-rule-strong bg-paper text-ink hover:border-ink-soft hover:bg-[#f5f7fa] active:bg-desk',
  ghost: 'text-ink-soft hover:bg-ink/5 hover:text-ink active:bg-ink/10',
};

const SIZES: Record<Size, string> = {
  // 44px touch targets on small screens, slightly tighter on desktop.
  md: 'min-h-11 px-4 text-sm sm:min-h-10',
  sm: 'min-h-11 px-3 text-sm sm:min-h-9',
};

interface ButtonStyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

function buttonClasses({ variant = 'primary', size = 'md', className }: ButtonStyleProps) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = ComponentProps<'button'> & ButtonStyleProps;

export function Button({ variant, size, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & ButtonStyleProps;

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses({ variant, size, className })} {...props} />;
}
