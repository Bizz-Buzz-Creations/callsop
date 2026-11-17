// Tests netlify/edge-functions/ip-filter.js by calling it with fake requests.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "netlify/edge-functions/ip-filter.js");

let pass = 0, fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (got ${got}, want ${want})`}`);
};

const origLog = console.log;
const run = async (handler, xff) => {
  const headers = new Headers({ accept: "*/*" });
  if (xff !== undefined) headers.set("x-forwarded-for", xff);
  console.log = () => {}; // the function logs every client IP
  try {
    const res = await handler(new Request("https://x.test/", { headers }), { next: () => "NEXT" });
    return res === "NEXT" ? "ALLOWED" : res.status;
  } finally {
    console.log = origLog;
  }
};

const real = (await import(pathToFileURL(SRC).href)).default;
const R = (xff) => run(real, xff);

check("exact IPv4 allowed", await R("103.217.245.94"), "ALLOWED");
check("last exact IPv4 allowed", await R("103.217.247.145"), "ALLOWED");
check("/24 low edge", await R("111.235.67.0"), "ALLOWED");
check("/24 high edge", await R("111.235.67.255"), "ALLOWED");
check("just outside /24 (67 -> 68)", await R("111.235.68.1"), 403);
check("just outside /24 (67 -> 66)", await R("111.235.66.255"), 403);
check("unrelated IPv4 denied", await R("8.8.8.8"), 403);
check("neighbour of exact IP denied", await R("103.217.245.95"), 403);
check("X-Forwarded-For list uses the first entry (allowed first)", await R("103.217.245.94, 10.0.0.1"), "ALLOWED");
check("X-Forwarded-For list uses the first entry (denied first)", await R("8.8.8.8, 103.217.245.94"), 403);
check("IPv4-mapped IPv6 of an allowed IP", await R("::ffff:103.217.245.94"), "ALLOWED");
check("IPv4-mapped IPv6 (hex form) of an allowed IP", await R("::ffff:67d9:f55e"), "ALLOWED");
check("IPv4-mapped IPv6 of a denied IP", await R("::ffff:8.8.8.8"), 403);
check("plain IPv6 denied (no IPv6 rules)", await R("2001:db8::1"), 403);
check("missing header denied", await R(undefined), 403);
check("empty header denied", await R(""), 403);
check("garbage denied", await R("not-an-ip"), 403);
check("octet > 255 denied", await R("103.217.245.999"), 403);
check("leading-zero octet denied", await R("103.217.245.094"), 403);
check("short IPv4 denied", await R("103.217.245"), 403);
{
  const res = await real(new Request("https://x.test/", { headers: { "x-forwarded-for": "8.8.8.8", accept: "*/*" } }), { next: () => "NEXT" });
  check("non-HTML deny body", await res.text(), "Access Denied");
}

// The same code with a different allowlist: IPv6 ranges and invalid entries.
const patched = readFileSync(SRC, "utf8").replace(
  /const allowedIPs = \[[\s\S]*?\];/,
  `const allowedIPs = ["2001:db8::/32","2a00:1450:4009::1","fe80::/10","10.0.0.0/8","300.1.1.1","1.2.3.4/33","1.2.3.4/abc","::ffff:5.6.7.0/120","zzzz::1","9.9.9.9"];`
);
const file = join(mkdtempSync(join(tmpdir(), "ipfilter-")), "ip-filter.mjs");
writeFileSync(file, patched);
const errors = [];
const origErr = console.error;
console.error = (...a) => errors.push(a.join(" "));
const v6 = (await import(pathToFileURL(file).href)).default;
console.error = origErr;
const V = (xff) => run(v6, xff);

check("v6 /32 low", await V("2001:db8::"), "ALLOWED");
check("v6 /32 inside", await V("2001:db8:ffff:ffff:ffff:ffff:ffff:ffff"), "ALLOWED");
check("v6 /32 outside", await V("2001:db9::1"), 403);
check("v6 exact", await V("2a00:1450:4009::1"), "ALLOWED");
check("v6 exact, expanded form", await V("2a00:1450:4009:0:0:0:0:1"), "ALLOWED");
check("v6 exact neighbour denied", await V("2a00:1450:4009::2"), 403);
check("v6 link-local /10", await V("fe80::1234"), "ALLOWED");
check("v6 with zone id", await V("fe80::1%eth0"), "ALLOWED");
check("v6 bracketed", await V("[2001:db8::5]"), "ALLOWED");
check("v6 uppercase", await V("2001:DB8::5"), "ALLOWED");
check("v6 never matches an IPv4 rule", await V("::a00:1"), 403);
check("v4 /8 rule", await V("10.200.3.4"), "ALLOWED");
check("v4 exact after bad entries", await V("9.9.9.9"), "ALLOWED");
check("v4-mapped client vs v4 rule", await V("::ffff:10.1.2.3"), "ALLOWED");
check("invalid IPv6 (two ::) denied", await V("1::2::3"), 403);
check("invalid IPv6 (too many groups) denied", await V("1:2:3:4:5:6:7:8:9"), 403);
check("invalid IPv6 (9 groups with ::) denied", await V("1:2:3:4:5:6:7:8::"), 403);
check("invalid allowlist entries are logged (count)", errors.length, 5);

console.log(fail === 0 ? `\nALL PASSED  (${pass} passed)` : `\n${fail} FAILED  (${pass} passed)`);
process.exit(fail ? 1 : 0);
