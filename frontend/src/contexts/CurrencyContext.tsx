import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { api, meApi } from '../lib/api';

export type Currency = 'EUR' | 'BRL' | 'USD' | 'GBP';

interface CurrencyContextValue {
  currency: Currency;
  converting: boolean;
  changeCurrency: (to: Currency) => void;
  formatAmount: (value: string | number) => string;
}

const LOCALE_MAP: Record<Currency, string> = {
  EUR: 'pt-PT',
  GBP: 'en-GB',
  BRL: 'pt-BR',
  USD: 'en-US',
};

const STORAGE_KEY = 'billflow_currency';
const VALID: Currency[] = ['EUR', 'USD', 'GBP', 'BRL'];

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

function getInitialCurrency(): Currency {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (VALID.includes(stored as Currency)) return stored as Currency;
  } catch { /* localStorage unavailable */ }
  return 'EUR';
}

async function fetchRate(from: Currency, to: Currency): Promise<number> {
  if (from === to) return 1;
  const { data } = await api.get<{ rate: number }>('/me/exchange-rate', { params: { from, to } });
  return data.rate;
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [currency, setCurrencyState] = useState<Currency>(getInitialCurrency);
  const [converting, setConverting] = useState(false);

  // Sync with user's saved currency when auth loads
  useEffect(() => {
    if (!user?.currency) return;
    const c = user.currency as Currency;
    if (VALID.includes(c)) {
      setCurrencyState(c);
      try { localStorage.setItem(STORAGE_KEY, c); } catch { /* ignore */ }
    }
  }, [user?.currency]);

  function formatAmount(value: string | number): string {
    const numeric = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numeric)) return '';
    return new Intl.NumberFormat(LOCALE_MAP[currency], {
      style: 'currency',
      currency,
    }).format(numeric);
  }

  const changeCurrency = useCallback(async (to: Currency) => {
    if (to === currency || converting) return;

    if (!user) {
      setCurrencyState(to);
      try { localStorage.setItem(STORAGE_KEY, to); } catch { /* ignore */ }
      return;
    }

    setConverting(true);
    try {
      const baseCurrency = (user.baseCurrency ?? 'EUR') as Currency;
      // Always fetch rate from base currency → target (never from already-converted values)
      const rate = await fetchRate(baseCurrency, to);
      await meApi.updateCurrency(to, rate);
      setCurrencyState(to);
      try { localStorage.setItem(STORAGE_KEY, to); } catch { /* ignore */ }
      await qc.invalidateQueries();
      toast.success(`Currency changed to ${to}`);
    } catch {
      toast.error('Failed to change currency. Please try again.');
    } finally {
      setConverting(false);
    }
  }, [currency, user, converting, qc, toast]);

  return (
    <CurrencyContext.Provider value={{ currency, converting, changeCurrency, formatAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider');
  return ctx;
}
