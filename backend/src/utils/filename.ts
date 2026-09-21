/**
 * Make a user-controlled invoice number safe for a Content-Disposition filename
 * (prevents header injection via quotes/control characters).
 */
export function safeFilename(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+/, "");
  return cleaned.slice(0, 80) || "invoice";
}
