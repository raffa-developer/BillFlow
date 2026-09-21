import { pool } from "../db/pool";

export type UserCurrency = {
  currency: string;
  baseCurrency: string;
  /** Conversion factor baseCurrency -> currency (1 when on the base currency). */
  rate: number;
};

export async function getUserCurrency(userId: number): Promise<UserCurrency> {
  const { rows: [row] } = await pool.query(
    `SELECT currency, "baseCurrency", "currencyRate" FROM "User" WHERE id = $1`,
    [userId]
  );
  const rawRate = row ? Number(row.currencyRate) : 1;
  const onBase = !row || row.currency === row.baseCurrency;
  const rate = onBase || !Number.isFinite(rawRate) || rawRate <= 0 ? 1 : rawRate;
  return {
    currency: row?.currency ?? "EUR",
    baseCurrency: row?.baseCurrency ?? "EUR",
    rate,
  };
}

export const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Convert a display-currency amount into full-precision base-currency values. */
export const toBase = (display: number, rate: number) =>
  rate === 1 ? display : round6(display / rate);
