import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type Currency = 'USD' | 'RUB' | 'UAH';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  formatPrice: (amountInUsd: number) => string;
  convertPrice: (amountInUsd: number) => { value: number; formatted: string; symbol: string };
}

const RATES: Record<Currency, { rate: number; symbol: string; prefix: boolean }> = {
  USD: { rate: 1.0, symbol: '$', prefix: true },
  RUB: { rate: 92.0, symbol: '₽', prefix: false },
  UAH: { rate: 41.5, symbol: '₴', prefix: false },
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      const saved = localStorage.getItem('mintaly_currency') as Currency;
      if (saved === 'USD' || saved === 'RUB' || saved === 'UAH') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'USD';
  });

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem('mintaly_currency', c);
    } catch {
      // ignore
    }
  };

  const convertPrice = (amountInUsd: number) => {
    const info = RATES[currency];
    const converted = (Number(amountInUsd) || 0) * info.rate;
    let formattedVal = '';
    if (currency === 'USD') {
      formattedVal = converted % 1 === 0 ? converted.toFixed(0) : converted.toFixed(2);
    } else {
      formattedVal = Math.round(converted).toLocaleString('ru-RU');
    }
    const formatted = info.prefix ? `${info.symbol}${formattedVal}` : `${formattedVal} ${info.symbol}`;
    return {
      value: converted,
      formatted,
      symbol: info.symbol,
    };
  };

  const formatPrice = (amountInUsd: number): string => {
    return convertPrice(amountInUsd).formatted;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, convertPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
