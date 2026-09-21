import { AppError } from "./errors";

export function parseIdParam(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new AppError("Invalid id", 400);
  }
  return id;
}
