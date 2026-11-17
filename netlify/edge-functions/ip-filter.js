// Allowlist of client IPs / CIDR ranges. Both IPv4 and IPv6 are supported,
// e.g. "203.0.113.7", "111.235.67.0/24", "2001:db8::/32".
// Write IPv4 entries in plain dotted form (not ::ffff:a.b.c.d).
const allowedIPs = [
  "103.217.245.94",
  "103.148.144.47",
  "111.235.67.0/24",
  "202.89.70.6",
  "103.148.144.22",
  "103.217.247.145",
];

// ---- IP parsing (BigInt so one code path handles 32- and 128-bit) ----------

const parseIPv4 = (text) => {
  const octets = text.split(".");
  if (octets.length !== 4) return null;
  let value = 0n;
  for (const octet of octets) {
    // No leading zeros ("01") to avoid octal ambiguity; max 255.
    if (!/^(0|[1-9]\d{0,2})$/.test(octet) || Number(octet) > 255) return null;
    value = (value << 8n) | BigInt(octet);
  }
  return value;
};

const parseIPv6 = (text) => {
  let s = text.split("%")[0]; // drop zone id, e.g. fe80::1%eth0

  // Embedded IPv4 tail, e.g. ::ffff:1.2.3.4 -> ::ffff:0102:0304
  if (s.includes(".")) {
    const cut = s.lastIndexOf(":") + 1;
    const v4 = parseIPv4(s.slice(cut));
    if (v4 === null) return null;
    s = `${s.slice(0, cut)}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  // Without "::" all 8 groups must be present; "::" must stand for at least one.
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null;

  let value = 0n;
  for (const group of [...head, ...Array(fill).fill("0"), ...tail]) {
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
    value = (value << 16n) | BigInt(`0x${group}`);
  }
  return value;
};

// Returns { bits: 32 | 128, value: BigInt } or null if not a valid address.
const parseAddress = (raw) => {
  const text = String(raw).trim().replace(/^\[(.*)\]$/, "$1");

  if (text.includes(":")) {
    const value = parseIPv6(text);
    if (value === null) return null;
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) is really an IPv4 client.
    return value >> 32n === 0xffffn
      ? { bits: 32, value: value & 0xffffffffn }
      : { bits: 128, value };
  }

  const value = parseIPv4(text);
  return value === null ? null : { bits: 32, value };
};

// "1.2.3.0/24" | "2001:db8::/32" | "1.2.3.4"  ->  { bits, value, prefix } | null
const parseRule = (entry) => {
  const [addr, length, ...extra] = entry.split("/");
  const parsed = parseAddress(addr);
  if (!parsed || extra.length) return null;
  // An IPv4-mapped IPv6 CIDR would need its prefix re-based; not supported.
  if (length !== undefined && addr.includes(":") && parsed.bits === 32) return null;

  const prefix = length === undefined ? parsed.bits : /^\d+$/.test(length) ? Number(length) : -1;
  if (prefix < 0 || prefix > parsed.bits) return null;
  return { ...parsed, prefix };
};

const rules = allowedIPs.flatMap((entry) => {
  const rule = parseRule(entry);
  if (!rule) console.error(`ip-filter: ignoring invalid allowlist entry "${entry}"`);
  return rule ? [rule] : [];
});

const isIpAllowed = (clientIP) => {
  const ip = parseAddress(clientIP);
  if (!ip) return false;
  return rules.some((rule) => {
    if (rule.bits !== ip.bits) return false;
    const shift = BigInt(rule.bits - rule.prefix);
    return ip.value >> shift === rule.value >> shift;
  });
};

// ---- Edge function ----------------------------------------------------------

export default async (request, context) => {
  const clientIP = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  console.log("Client IP:", clientIP);

  if (!clientIP || !isIpAllowed(clientIP)) {
    // Serve HTML only for root paths, not for assets
    if (request.headers.get("accept")?.includes("text/html")) {
      let html = "<h1>Access Denied</h1>";
      try {
        const res = await fetch(
          "https://callsop.netlify.app/access-denied.html"
        );
        html = await res.text();
      } catch (err) {
        console.error("Failed to load custom Access Denied page", err);
      }

      return new Response(html, {
        status: 403,
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "no-store",
        },
      });
    }

    // For non-HTML requests, return a plain 403
    return new Response("Access Denied", { status: 403 });
  }

  return context.next();
};
