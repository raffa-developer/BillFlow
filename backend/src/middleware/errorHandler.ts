import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: "Validation error", issues: err.flatten().fieldErrors });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Express/body-parser client errors (e.g. malformed JSON: status 400)
  const clientStatus = (err as { statusCode?: number; status?: number } | null)?.statusCode
    ?? (err as { status?: number } | null)?.status;
  if (typeof clientStatus === "number" && clientStatus >= 400 && clientStatus < 500) {
    return res.status(clientStatus).json({ message: "Invalid request" });
  }

  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
}
