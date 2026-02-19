import { cn } from '@/lib/utils';

type LogoVariant = 'hero' | 'sidebar' | 'sidebar-collapsed' | 'header' | 'inline' | 'card';

interface LogoProps {
  variant?: LogoVariant;
  className?: string;
}

const variantStyles: Record<LogoVariant, string> = {
  hero: 'h-32 sm:h-40 w-auto max-w-[420px] drop-shadow-[0_4px_28px_rgba(0,0,0,0.1)]',
  sidebar: 'h-12 w-auto max-w-[220px] min-w-[120px] drop-shadow-sm',
  'sidebar-collapsed': 'h-9 w-[52px] object-contain object-left',
  header: 'h-11 w-auto max-w-[200px] drop-shadow-sm',
  inline: 'h-14 w-auto max-w-[260px] drop-shadow-sm sm:h-20 sm:max-w-[320px]',
  card: 'h-20 w-auto max-w-[280px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.06)]',
};

export function Logo({ variant = 'inline', className }: LogoProps) {
  return (
    <img
      src="/logo-maute360.png"
      alt="Maute360 - Soluções em Negócios"
      className={cn('object-contain select-none', variantStyles[variant], className)}
      draggable={false}
    />
  );
}
