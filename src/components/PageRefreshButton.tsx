import { RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

interface PageRefreshButtonProps {
  onClick: () => void | Promise<void>;
  isRefreshing?: boolean;
  label?: string;
  className?: string;
}

export function PageRefreshButton({
  onClick,
  isRefreshing = false,
  label = '刷新',
  className,
}: PageRefreshButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isRefreshing}
      title={isRefreshing ? `${label}中` : label}
      aria-label={isRefreshing ? `${label}中` : label}
      className={cn(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
    >
      <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
    </button>
  );
}
