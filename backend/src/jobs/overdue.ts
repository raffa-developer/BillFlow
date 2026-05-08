import cron from "node-cron";
import { pool } from "../db/pool";

async function markOverdueOnce(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE "Invoice" SET status = 'OVERDUE'::"InvoiceStatus"
     WHERE status = 'PENDING'::"InvoiceStatus" AND "dueDate" < NOW()`
  );
  return rowCount ?? 0;
}

export function scheduleOverdueJob(): void {
  cron.schedule("0 3 * * *", async () => {
    try {
      const count = await markOverdueOnce();
      if (count > 0) console.log(`[overdue-cron] marked ${count} invoice(s) as OVERDUE`);
    } catch (err) {
      console.error("[overdue-cron] failed", err);
    }
  });

  void markOverdueOnce()
    .then((count) => {
      if (count > 0) console.log(`[overdue-cron] startup: marked ${count} invoice(s) as OVERDUE`);
    })
    .catch((err) => console.error("[overdue-cron] startup failed", err));
}
