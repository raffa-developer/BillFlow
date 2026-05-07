import { AppError } from "./errors";

export function parseIdParam(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError("Invalid id", 400);
  }
  return id;
}
