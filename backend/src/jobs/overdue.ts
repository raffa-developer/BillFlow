import cron from "node-cron";
import { prisma } from "../db/prisma";

async function markOverdueOnce(): Promise<number> {
  const now = new Date();
  const result = await prisma.invoice.updateMany({
    where: { status: "PENDING", dueDate: { lt: now } },
    data: { status: "OVERDUE" },
  });
  return result.count;
}

export function scheduleOverdueJob(): void {
  // Daily at 03:00 server time
  cron.schedule("0 3 * * *", async () => {
    try {
      const count = await markOverdueOnce();
      if (count > 0) {
        // eslint-disable-next-line no-console
        console.log(`[overdue-cron] marked ${count} invoice(s) as OVERDUE`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[overdue-cron] failed", err);
    }
  });

  // Run once on startup so we don't have to wait for 03:00 in dev.
  void markOverdueOnce()
    .then((count) => {
      if (count > 0) {
        // eslint-disable-next-line no-console
        console.log(`[overdue-cron] startup: marked ${count} invoice(s) as OVERDUE`);
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[overdue-cron] startup failed", err);
    });
}
