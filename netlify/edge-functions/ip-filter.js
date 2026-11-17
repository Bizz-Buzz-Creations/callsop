// IP access control. Netlify runs this before EVERY request (see netlify.toml).
//
// Who gets in:
//   1. The always-allowed IPs (netlify/api/access.js + ALWAYS_ALLOWED_IPS): always.
//   2. Everyone else: only if the filter is switched ON in the admin panel
//      (Test Admin Panel -> Access) AND their IP is in the admin's list.
//      While the filter is OFF, everyone gets in.
//
// The list lives in the database. This function fetches it from the API
// (/api/edge/access, guarded by the EDGE_SECRET environment variable) and
// remembers it for a minute.
//
// Failure behaviour (chosen so a mistake cannot lock everyone out silently):
//   - EDGE_SECRET not set, or the API answers 401/403/404/503 -> NOT set up yet:
//     the filter does nothing (same as before this feature existed).
//   - The API/database is down but a list was read within the last 24 hours ->
//     that last list keeps being used: listed IPs still get in, others stay out.
//   - The API cannot be reached and there is NO remembered list (for example a
//     freshly started edge server during an outage) -> fail CLOSED: only the
//     always-allowed IPs get in.
import { addressToString, matchesAny, parseAddress } from "../api/ip.js";
import { alwaysAllowedRules, parseList } from "../api/access.js";

const CACHE_MS = 60_000; // how long a fetched list is trusted
const STALE_OK_MS = 24 * 60 * 60_000; // if the API is down, keep using the last list this long
const RETRY_MS = 10_000; // when the API is down, retry after this long
const FETCH_TIMEOUT_MS = 3000;

// at = when to next try the API; loadedAt = when the list was REALLY last read (its true age)
let cache = null; // { at, loadedAt, open, enabled, rules }

const env = (name) => globalThis.Netlify?.env?.get(name) ?? globalThis.process?.env?.[name];

// -> { kind: "ok", state } | { kind: "open" } (not set up) | { kind: "unknown" }
const loadState = async (origin, secret) => {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return cache.open ? { kind: "open" } : { kind: "ok", state: cache };
  }

  try {
    const res = await fetch(`${origin}/api/edge/access`, {
      headers: { "x-edge-secret": secret },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if ([401, 403, 404, 503].includes(res.status)) {
      console.error(`ip-filter: access list not available (HTTP ${res.status}); filter not enforced`);
      cache = { at: now, open: true };
      return { kind: "open" };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache = { at: now, loadedAt: now, open: false, enabled: data.enabled === true, rules: parseList(data.rules || []) };
    return { kind: "ok", state: cache };
  } catch (err) {
    console.error("ip-filter: could not load the access list:", err);
    if (cache && !cache.open && now - cache.loadedAt < STALE_OK_MS) {
      cache.at = now - CACHE_MS + RETRY_MS; // keep the old list, try again soon (its age is NOT reset)
      return { kind: "ok", state: cache };
    }
    return { kind: "unknown" };
  }
};

const denied = async (request, url, ip) => {
  // Echo only the cleaned-up canonical form (digits, dots, colons, hex), never raw header text.
  const parsed = parseAddress(ip);
  const shownIp = parsed ? addressToString(parsed) : "";
  if (request.headers.get("accept")?.includes("text/html")) {
    let html = "<h1>Access Denied</h1>";
    try {
      const res = await fetch(`${url.origin}/access-denied.html`);
      if (res.ok) html = await res.text();
    } catch (err) {
      console.error("Failed to load custom Access Denied page", err);
    }
    if (shownIp) {
      const note = `<p style="font-family:sans-serif;text-align:center">Your IP address: ${shownIp}</p>`;
      html = html.includes("</body>") ? html.replace("</body>", `${note}</body>`) : html + note;
    }
    return new Response(html, {
      status: 403,
      headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
    });
  }
  // Assets, API calls and other non-page requests get a plain 403.
  return new Response("Access Denied", { status: 403, headers: { "Cache-Control": "no-store" } });
};

export default async (request, context) => {
  const url = new URL(request.url);
  // Netlify's own view of the client IP is trusted; the header is only a fallback.
  const ip = context?.ip || request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  console.log("Client IP:", ip);

  // These two must always work: the list fetch itself (the API checks the secret)
  // and the page shown to blocked visitors.
  if (url.pathname === "/api/edge/access" || url.pathname === "/access-denied.html") {
    return context.next();
  }

  const secret = env("EDGE_SECRET");
  if (!secret) return context.next(); // feature not set up yet: do nothing

  const client = parseAddress(ip);
  if (client && matchesAny(client, alwaysAllowedRules(env("ALWAYS_ALLOWED_IPS")))) {
    return context.next();
  }

  const loaded = await loadState(url.origin, secret);
  if (loaded.kind === "open") return context.next();
  if (loaded.kind === "ok") {
    if (!loaded.state.enabled) return context.next(); // filter switched off
    if (client && matchesAny(client, loaded.state.rules)) return context.next();
  }
  return denied(request, url, ip);
};
