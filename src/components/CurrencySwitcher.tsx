import { useCurrency, type Currency } from '../context/CurrencyContext';
import { cn } from '../utils/helpers';

interface CurrencySwitcherProps {
  className?: string;
  size?: 'sm' | 'md';
}

const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: 'USD', label: 'USD', symbol: '$' },
  { code: 'RUB', label: 'RUB', symbol: '₽' },
  { code: 'UAH', label: 'UAH', symbol: '₴' },
];

export function CurrencySwitcher({ className, size = 'sm' }: CurrencySwitcherProps) {
  const { currency, setCurrency } = useCurrency();

  return (
    <div
      role="group"
      aria-label="Выбор валюты"
      className={cn(
        'inline-flex items-center p-0.5 bg-zinc-900/90 border border-zinc-800 rounded-lg shadow-inner backdrop-blur',
        className
      )}
    >
      {CURRENCIES.map((c) => {
        const active = currency === c.code;
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => setCurrency(c.code)}
            className={cn(
              'rounded-md font-medium transition-all duration-150 select-none flex items-center gap-1 cursor-pointer',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active
                ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            )}
          >
            <span className={cn('opacity-75', active ? 'text-zinc-700' : 'text-zinc-500')}>
              {c.symbol}
            </span>
            <span>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
