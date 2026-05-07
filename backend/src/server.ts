import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { scheduleOverdueJob } from "./jobs/overdue";

const server = app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
  scheduleOverdueJob();
});

async function shutdown(signal: string) {
  console.log(`Shutting down on ${signal}`);
  server.close(() => {
    console.log("HTTP server closed");
  });
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
