import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { authRouter } from "./routes/auth";
import { clientsRouter } from "./routes/clients";
import { healthRouter } from "./routes/health";
import { invoicesRouter } from "./routes/invoices";
import { meRouter } from "./routes/me";
import { productsRouter } from "./routes/products";
import { publicInvoicesRouter } from "./routes/publicInvoices";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/products", productsRouter);
app.use("/api/public/invoices", publicInvoicesRouter);

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.use(errorHandler);
