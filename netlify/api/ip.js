// IP address helpers shared by the API and the edge function.
// Pure JavaScript with no imports, so it runs unchanged in Node and in Deno.
// BigInt lets one code path handle both IPv4 (32-bit) and IPv6 (128-bit).

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

// Returns { bits: 32 | 128, value: BigInt } or null if it is not a valid address.
export const parseAddress = (raw) => {
  const text = String(raw ?? "").trim().replace(/^\[(.*)\]$/, "$1");
  if (!text) return null;

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
// Host bits are cleared, so "1.2.3.77/24" becomes the network 1.2.3.0/24.
export const parseRule = (entry) => {
  const [addr, length, ...extra] = String(entry ?? "").trim().split("/");
  const parsed = parseAddress(addr);
  if (!parsed || extra.length) return null;
  // An IPv4-mapped IPv6 CIDR would need its prefix re-based; not supported.
  if (length !== undefined && addr.includes(":") && parsed.bits === 32) return null;

  const prefix = length === undefined ? parsed.bits : /^\d+$/.test(length) ? Number(length) : -1;
  if (prefix < 0 || prefix > parsed.bits) return null;
  const shift = BigInt(parsed.bits - prefix);
  return { bits: parsed.bits, value: (parsed.value >> shift) << shift, prefix };
};

// True if `ip` (a string or a parsed address) is inside any of the parsed rules.
export const matchesAny = (ip, rules) => {
  const parsed = typeof ip === "string" ? parseAddress(ip) : ip;
  if (!parsed) return false;
  return rules.some((rule) => {
    if (rule.bits !== parsed.bits) return false;
    const shift = BigInt(rule.bits - rule.prefix);
    return parsed.value >> shift === rule.value >> shift;
  });
};

// Canonical text for an address or rule: dotted IPv4, or 8 lower-case hex groups
// for IPv6, plus "/prefix" when it is a range.
export const addressToString = ({ bits, value }) => {
  if (bits === 32) return [24n, 16n, 8n, 0n].map((s) => Number((value >> s) & 255n)).join(".");
  return Array.from({ length: 8 }, (_, i) => ((value >> BigInt((7 - i) * 16)) & 0xffffn).toString(16)).join(":");
};

export const ruleToString = (rule) =>
  rule.prefix === rule.bits ? addressToString(rule) : `${addressToString(rule)}/${rule.prefix}`;

// Rules this wide are almost certainly a typo and would let in huge parts of the internet.
export const isTooBroad = (rule) => rule.prefix < (rule.bits === 32 ? 8 : 16);
