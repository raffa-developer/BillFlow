import { lookup } from "node:dns/promises";
import net from "node:net";

const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 5 * 1024 * 1024;

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase().split("%")[0];
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }
  return true;
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Blocked protocol");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Blocked host");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Blocked address");
    return;
  }
  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new Error("Blocked address");
  }
}

/**
 * Fetch an image from a user-supplied URL (company logo) with SSRF guards:
 * http(s) only, no private/loopback/link-local targets, capped redirects,
 * 5s timeout, 5MB max.
 */
export async function fetchLogoBuffer(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  try {
    if (url.startsWith("data:")) {
      const base64 = url.split(",")[1];
      return base64 ? Buffer.from(base64, "base64") : null;
    }

    let target = new URL(url);
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      await assertPublicUrl(target);

      const res = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        target = new URL(location, target);
        continue;
      }
      if (!res.ok) return null;

      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > MAX_BYTES) return null;

      const buffer = Buffer.from(await res.arrayBuffer());
      return buffer.length > MAX_BYTES ? null : buffer;
    }
    return null;
  } catch {
    return null;
  }
}
