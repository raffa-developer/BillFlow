import React, { createContext, useContext, useState } from 'react';

type Currency = 'EUR' | 'BRL' | 'USD' | 'GBP';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatAmount: (value: string | number) => string;
}

const LOCALE_MAP: Record<Currency, string> = {
  EUR: 'pt-PT',
  GBP: 'pt-PT',
  BRL: 'pt-BR',
  USD: 'en-US',
};

const STORAGE_KEY = 'billflow_currency';

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

function getInitialCurrency(): Currency {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'EUR' || stored === 'BRL' || stored === 'USD' || stored === 'GBP') {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return 'EUR';
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(getInitialCurrency);

  function setCurrency(next: Currency) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
    setCurrencyState(next);
  }

  function formatAmount(value: string | number): string {
    const numeric = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numeric)) return '';
    return new Intl.NumberFormat(LOCALE_MAP[currency], {
      style: 'currency',
      currency,
    }).format(numeric);
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return ctx;
}
