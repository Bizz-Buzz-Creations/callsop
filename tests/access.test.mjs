// IP access control: the shared IP code, the admin API routes, and the real edge
// function working against the real API and a real MongoDB. See tests/README.md.
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "package.json"));
const url = (p) => pathToFileURL(join(ROOT, p)).href;

process.env.MONGODB_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/";
process.env.MONGODB_DB = `callsop_test_access_${Date.now()}`;
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
delete process.env.EDGE_SECRET;
delete process.env.ALWAYS_ALLOWED_IPS;
globalThis.Netlify = { env: { get: (k) => process.env[k] } }; // what Netlify provides to edge functions

const ip = await import(url("netlify/api/ip.js"));
const { handle } = await import(url("netlify/api/routes.js"));
const { getDb, closeDb } = await import(url("netlify/api/db.js"));
const { hashPassword } = await import(url("netlify/api/security.js"));
void require;

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + extra}`); };
const section = (t) => console.log(`\n== ${t} ==`);

// ============================================================================
section("ip.js: parsing and matching");
const R = (s) => ip.parseRule(s);
const hit = (addr, rule) => ip.matchesAny(addr, [R(rule)]);
ok("exact IPv4", hit("103.217.245.94", "103.217.245.94") && !hit("103.217.245.95", "103.217.245.94"));
ok("/24 edges", hit("111.235.67.0", "111.235.67.0/24") && hit("111.235.67.255", "111.235.67.0/24") && !hit("111.235.68.0", "111.235.67.0/24") && !hit("111.235.66.255", "111.235.67.0/24"));
ok("host bits are cleared (1.2.3.77/24 -> 1.2.3.0/24)", ip.ruleToString(R("1.2.3.77/24")) === "1.2.3.0/24");
ok("a plain IP is stored without /32", ip.ruleToString(R("203.0.113.7")) === "203.0.113.7" && ip.ruleToString(R("203.0.113.7/32")) === "203.0.113.7");
ok("IPv4-mapped IPv6 client matches the IPv4 rule", hit("::ffff:103.217.245.94", "103.217.245.94") && hit("::ffff:67d9:f55e", "103.217.245.94"));
ok("IPv6 /32 range", hit("2001:db8:ffff::1", "2001:db8::/32") && !hit("2001:db9::1", "2001:db8::/32"));
ok("IPv6 forms are equal (compressed vs full, upper vs lower case)", ip.ruleToString(R("2001:DB8::1")) === ip.ruleToString(R("2001:0db8:0:0:0:0:0:1")));
ok("IPv6 with zone id and brackets", hit("fe80::1%eth0", "fe80::/10") && hit("[2001:db8::5]", "2001:db8::/32"));
ok("an IPv6 address never matches an IPv4 rule", !hit("::a00:1", "10.0.0.0/8"));
for (const bad of ["", "abc", "1.2.3", "1.2.3.4.5", "300.1.1.1", "01.2.3.4", "1.2.3.4/33", "1.2.3.4/abc", "1.2.3.4/-1", "1.2.3.4/24/8", "1::2::3", "1:2:3:4:5:6:7:8:9", "::ffff:5.6.7.0/120", null, undefined])
  ok(`invalid is rejected: ${JSON.stringify(bad)}`, R(bad) === null);
ok("a too-wide range is flagged (/4 v4, /8 ok, /8 v6 flagged)", ip.isTooBroad(R("10.0.0.0/4")) && !ip.isTooBroad(R("10.0.0.0/8")) && ip.isTooBroad(R("2001::/8")) && !ip.isTooBroad(R("2001:db8::/32")));
ok("0.0.0.0/0 is flagged", ip.isTooBroad(R("0.0.0.0/0")));

// ============================================================================
const db = await getDb();
const call = async (method, path, { token, body, headers = {}, client = "10.0.0.1" } = {}) => {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (body !== undefined) h["content-type"] = "application/json";
  const res = await handle(new Request(`http://x.test/api${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), { ip: client });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
};
const is = (r, status, name) => ok(name, r.status === status, `got ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);

await db.collection("admins").insertOne({ email: "boss", passwordHash: await hashPassword("secret-pass"), createdAt: new Date() });
const T = (await call("POST", "/admin/login", { body: { email: "boss", password: "secret-pass" } })).data.token;
const A = (await call("POST", "/session")).data.token;

section("API: admin access routes need an admin");
is(await call("GET", "/admin/access"), 401, "no token -> 401");
is(await call("GET", "/admin/access", { token: A }), 401, "agent token -> 401");
is(await call("PUT", "/admin/access", { token: A, body: { enabled: true } }), 401, "agent cannot toggle");
is(await call("POST", "/admin/access/rules", { token: A, body: { value: "1.2.3.4" } }), 401, "agent cannot add rules");
is(await call("DELETE", "/admin/access/rules/000000000000000000000000", { token: A }), 401, "agent cannot delete rules");

section("API: defaults");
let r = await call("GET", "/admin/access", { token: T, client: "10.0.0.1" });
ok("filter starts OFF", r.data.enabled === false);
ok("the 6 default IPs were saved automatically (added by 'default')", r.data.rules.length === 6 && r.data.rules.every((x) => x.createdBy === "default") && ["103.86.180.158", "106.215.115.85", "106.219.172.24", "122.172.83.107", "14.96.246.106", "192.168.0.0/16"].every((v) => r.data.rules.some((x) => x.value === v)), JSON.stringify(r.data.rules.map((x) => x.value)));
ok("loading again does not duplicate them", (await call("GET", "/admin/access", { token: T })).data.rules.length === 6 && (await db.collection("ipRules").countDocuments()) === 6);
ok("shows the caller's IP and that it is not allowed", r.data.myIp === "10.0.0.1" && r.data.myIpAllowed === false);
ok("lists the 9 built-in always-allowed IPs (incl. the labeled office IPs)", r.data.alwaysAllowed.length === 9 && r.data.alwaysAllowed.includes("111.235.67.0/24") && r.data.alwaysAllowed.includes("171.78.155.25") && r.data.alwaysAllowed.includes("14.102.43.26") && r.data.alwaysAllowed.includes("122.179.140.142"));
ok("reports the edge secret as not configured", r.data.edgeConfigured === false);
r = await call("GET", "/admin/access", { token: T, client: "::ffff:103.217.245.94" });
ok("a built-in IP (even in mapped IPv6 form) is shown as allowed", r.data.myIpAllowed === true && r.data.myIp === "103.217.245.94", JSON.stringify(r.data));

section("API: adding rules");
const add = (body, opts = {}) => call("POST", "/admin/access/rules", { token: T, body, ...opts });
for (const bad of [{}, { value: "" }, { value: "abc" }, { value: "300.1.1.1" }, { value: "1.2.3.4/33" }, { value: 5 }, { value: { $ne: "" } }, { value: ["1.2.3.4"] }])
  is(await add(bad), 400, `invalid value refused: ${JSON.stringify(bad)}`);
is(await add({ value: "10.0.0.0/4" }), 400, "too-wide IPv4 range refused");
is(await add({ value: "0.0.0.0/0" }), 400, "allow-everyone range refused");
is(await add({ value: "2001::/8" }), 400, "too-wide IPv6 range refused");
is(await add({ value: "1.2.3.4", label: "x".repeat(81) }), 400, "label over 80 chars refused");
is(await add({ value: "1.2.3.4", label: { $ne: 1 } }), 400, "object as label refused");
is(await add({ value: "1.2.3.4", hours: 0 }), 400, "0 hours refused");
is(await add({ value: "1.2.3.4", hours: 1.5 }), 400, "fractional hours refused");
is(await add({ value: "1.2.3.4", hours: 24 * 366 }), 400, "more than a year refused");
ok("none of the refused requests saved anything (only the 6 defaults exist)", (await db.collection("ipRules").countDocuments()) === 6);
is(await add({ value: "203.0.113.7", label: "Ishika home" }), 201, "valid IP added");
is(await add({ value: "203.0.113.7/32" }), 409, "same IP written as /32 is a duplicate");
is(await add({ value: "198.51.100.77/24", label: "Branch office" }), 201, "range with host bits added");
is(await add({ value: "2001:DB8::1", hours: 24 }), 201, "IPv6 with a 24h expiry added");
r = await call("GET", "/admin/access", { token: T });
const byValue = Object.fromEntries(r.data.rules.map((x) => [x.value, x]));
ok("stored in canonical form", !!byValue["203.0.113.7"] && !!byValue["198.51.100.0/24"] && !!byValue["2001:db8:0:0:0:0:0:1"], JSON.stringify(Object.keys(byValue)));
ok("label, creator and expiry are kept", byValue["203.0.113.7"].label === "Ishika home" && byValue["203.0.113.7"].createdBy === "boss" && byValue["203.0.113.7"].expiresAt === null && Math.abs(new Date(byValue["2001:db8:0:0:0:0:0:1"].expiresAt) - (Date.now() + 86400000)) < 60000);
ok("rules are not flagged expired yet", r.data.rules.every((x) => x.expired === false));
const idOf = (value) => byValue[value].id;

section("API: default rules can be deleted and stay deleted");
const defaultId = (await call("GET", "/admin/access", { token: T })).data.rules.find((x) => x.value === "14.96.246.106").id;
is(await call("DELETE", `/admin/access/rules/${defaultId}`, { token: T }), 200, "a default rule can be deleted");
ok("it does not come back on the next load", !(await call("GET", "/admin/access", { token: T })).data.rules.some((x) => x.value === "14.96.246.106"));
ok("the other 5 defaults remain", (await db.collection("ipRules").countDocuments()) === 5 + 3);

section("API: turning the filter on cannot lock the admin out");
r = await call("PUT", "/admin/access", { token: T, body: { enabled: true }, client: "10.0.0.1" });
is(r, 409, "enabling while my IP is not allowed -> 409");
ok("message names my IP and says why", /10\.0\.0\.1/.test(r.data.error) && /lock/i.test(r.data.error), r.data.error);
is(await call("PUT", "/admin/access", { token: T, body: { enabled: "yes" } }), 400, "enabled must be a boolean");
ok("filter is still off after the refusal", (await call("GET", "/admin/access", { token: T })).data.enabled === false);
await call("POST", "/admin/access/rules", { token: T, body: { value: "10.0.0.1", label: "me" } });
is(await call("PUT", "/admin/access", { token: T, body: { enabled: true }, client: "10.0.0.1" }), 200, "after adding my IP, enabling works");
r = await call("GET", "/admin/access", { token: T, client: "10.0.0.1" });
ok("state shows ON and my IP allowed", r.data.enabled === true && r.data.myIpAllowed === true);
const myRule = r.data.rules.find((x) => x.value === "10.0.0.1").id;
r = await call("DELETE", `/admin/access/rules/${myRule}`, { token: T, client: "10.0.0.1" });
is(r, 409, "deleting the rule that keeps me in (filter ON) is refused");
ok("…with a clear message", /lock you out/i.test(r.data.error), r.data.error);
is(await call("DELETE", `/admin/access/rules/${idOf("203.0.113.7")}`, { token: T, client: "10.0.0.1" }), 200, "deleting some other rule is fine");
is(await call("DELETE", `/admin/access/rules/${idOf("203.0.113.7")}`, { token: T }), 404, "delete again -> 404");
is(await call("DELETE", "/admin/access/rules/not-an-id", { token: T }), 400, "malformed id -> 400");
is(await call("PUT", "/admin/access", { token: T, body: { enabled: false } }), 200, "turning OFF is always allowed");
is(await call("DELETE", `/admin/access/rules/${myRule}`, { token: T, client: "10.0.0.1" }), 200, "with the filter OFF the rule can be deleted");
is(await call("PUT", "/admin/access", { token: T, body: { enabled: true }, client: "103.217.245.94" }), 200, "a built-in IP can enable it without any rule");

section("API: expired rules");
await db.collection("ipRules").insertOne({ value: "192.0.2.50", label: "old visitor", createdAt: new Date(Date.now() - 2 * 86400000), createdBy: "boss", expiresAt: new Date(Date.now() - 1000) });
r = await call("GET", "/admin/access", { token: T, client: "192.0.2.50" });
ok("shown as expired", r.data.rules.find((x) => x.value === "192.0.2.50").expired === true);
ok("an expired rule does not allow its IP", r.data.myIpAllowed === false);

section("API: the edge endpoint (secret-guarded)");
is(await call("GET", "/edge/access"), 503, "no EDGE_SECRET configured -> 503");
process.env.EDGE_SECRET = "edge-secret-edge-secret-edge-secret-99";
is(await call("GET", "/edge/access"), 401, "no header -> 401");
is(await call("GET", "/edge/access", { headers: { "x-edge-secret": "wrong" } }), 401, "wrong secret -> 401");
is(await call("GET", "/edge/access", { headers: { "x-edge-secret": "edge-secret-edge-secret-edge-secret-98" } }), 401, "secret differing in one char -> 401");
is(await call("GET", "/edge/access", { token: T }), 401, "an admin token is not the edge secret");
r = await call("GET", "/edge/access", { headers: { "x-edge-secret": process.env.EDGE_SECRET } });
is(r, 200, "right secret -> 200");
ok("returns the switch and ACTIVE rules only (expired left out)", r.data.enabled === true && r.data.rules.includes("198.51.100.0/24") && r.data.rules.includes("2001:db8:0:0:0:0:0:1") && !r.data.rules.includes("192.0.2.50"), JSON.stringify(r.data));
ok("answer is never cached", r.headers.get("cache-control") === "no-store");
ok("the admin view now says the edge is configured", (await call("GET", "/admin/access", { token: T })).data.edgeConfigured === true);

// ============================================================================
// The real edge function, calling the real API (fetch is routed in-process)
const realFetch = globalThis.fetch;
let fetchMode = "api"; // "api" | "throw" | <http status number>
let listFetches = 0;
globalThis.fetch = async (input, init = {}) => {
  const u = new URL(typeof input === "string" ? input : input.url);
  if (u.pathname === "/access-denied.html") return new Response("<html><body><h1>Custom denied page</h1></body></html>", { status: 200 });
  listFetches++;
  if (fetchMode === "throw") throw new Error("network down");
  if (typeof fetchMode === "number") return new Response("{}", { status: fetchMode });
  return handle(new Request(u, { headers: init.headers }), { ip: "10.9.9.9" });
};
let version = 0;
const freshEdge = async () => (await import(`${url("netlify/edge-functions/ip-filter.js")}?v=${++version}`)).default;
const origLog = console.log, origErr = console.error;
const quiet = async (fn) => { console.log = () => {}; console.error = () => {}; try { return await fn(); } finally { console.log = origLog; console.error = origErr; } };
const hitEdge = (edge, client, { accept = "text/html", path = "/", xff } = {}) => quiet(async () => {
  const headers = new Headers({ accept });
  if (xff) headers.set("x-forwarded-for", xff);
  const res = await edge(new Request(`https://site.test${path}`, { headers }), { ip: client, next: () => "NEXT" });
  return res === "NEXT" ? { allowed: true } : { allowed: false, status: res.status, text: await res.text(), headers: res.headers };
});
const setAccess = (enabled) => db.collection("config").updateOne({ _id: "access" }, { $set: { enabled } }, { upsert: true });
await db.collection("ipRules").deleteMany({});
await db.collection("ipRules").insertMany([
  { value: "203.0.113.7", label: "a", createdAt: new Date(), expiresAt: null },
  { value: "198.51.100.0/24", label: "b", createdAt: new Date(), expiresAt: null },
  { value: "2001:db8:0:0:0:0:0:1", label: "c", createdAt: new Date(), expiresAt: null },
  { value: "192.0.2.50", label: "expired", createdAt: new Date(), expiresAt: new Date(Date.now() - 1000) },
]);

section("edge: not set up yet -> does nothing");
delete process.env.EDGE_SECRET;
await setAccess(true);
let edge = await freshEdge();
ok("no EDGE_SECRET: even with the switch ON, everyone gets in (as before this feature)", (await hitEdge(edge, "8.8.8.8")).allowed === true);
ok("…and the list was never fetched", listFetches === 0);
process.env.EDGE_SECRET = "edge-secret-edge-secret-edge-secret-99";

section("edge: filter OFF");
await setAccess(false);
edge = await freshEdge();
ok("anyone gets in while the switch is OFF", (await hitEdge(edge, "8.8.8.8")).allowed === true);

section("edge: filter ON");
await setAccess(true);
edge = await freshEdge();
listFetches = 0;
let out = await hitEdge(edge, "8.8.8.8");
ok("unknown IP is blocked with 403", out.allowed === false && out.status === 403);
ok("HTML visitors get the custom page plus THEIR IP", /Custom denied page/.test(out.text) && /Your IP address: 8\.8\.8\.8/.test(out.text), out.text);
ok("the answer is never cached", out.headers.get("cache-control") === "no-store");
out = await hitEdge(edge, "8.8.8.8", { accept: "application/json", path: "/api/test" });
ok("non-HTML requests get a plain 403", out.status === 403 && out.text === "Access Denied");
ok("two requests within a minute fetched the list ONCE (cached)", listFetches === 1, `fetches=${listFetches}`);
ok("a listed IP gets in", (await hitEdge(edge, "203.0.113.7")).allowed === true);
ok("an IP inside a listed range gets in", (await hitEdge(edge, "198.51.100.200")).allowed === true && (await hitEdge(edge, "198.51.101.1")).allowed === false);
ok("a listed IPv6 address gets in", (await hitEdge(edge, "2001:db8::1")).allowed === true);
ok("an EXPIRED rule no longer lets its IP in", (await hitEdge(edge, "192.0.2.50")).allowed === false);
const before = listFetches;
ok("built-in office IPs always get in", (await hitEdge(edge, "103.217.245.94")).allowed === true && (await hitEdge(edge, "111.235.67.99")).allowed === true && (await hitEdge(edge, "171.78.155.25")).allowed === true && (await hitEdge(edge, "14.102.43.26")).allowed === true && (await hitEdge(edge, "122.179.140.142")).allowed === true);
ok("a neighbour of a single built-in IP is NOT allowed (171.78.155.26)", (await hitEdge(edge, "171.78.155.26")).allowed === false);
ok("…without even needing the list", listFetches === before);
process.env.ALWAYS_ALLOWED_IPS = "192.0.2.99, 2001:db8:aaaa::/48";
ok("ALWAYS_ALLOWED_IPS adds more always-allowed IPs", (await hitEdge(edge, "192.0.2.99")).allowed === true && (await hitEdge(edge, "2001:db8:aaaa::5")).allowed === true);
delete process.env.ALWAYS_ALLOWED_IPS;
ok("a visitor with no readable IP is blocked", (await hitEdge(edge, undefined)).allowed === false);

section("edge: spoofing and safety");
out = await hitEdge(edge, "8.8.8.8", { xff: "103.217.245.94" });
ok("a forged X-Forwarded-For with an office IP does NOT help (Netlify's own IP wins)", out.allowed === false);
const noCtxIp = await quiet(async () => edge(new Request("https://site.test/", { headers: { accept: "text/html", "x-forwarded-for": "8.8.8.8%<script>alert(1)</script>" } }), { next: () => "NEXT" }));
ok("with no Netlify IP, a header fallback is used and no markup is echoed", noCtxIp.status === 403 && !/<script/i.test(await noCtxIp.text()));
ok("the list fetch path is never blocked (no loop)", (await hitEdge(edge, "8.8.8.8", { path: "/api/edge/access" })).allowed === true);
ok("the access-denied page is never blocked", (await hitEdge(edge, "8.8.8.8", { path: "/access-denied.html" })).allowed === true);

section("edge: when the list cannot be read");
fetchMode = "throw";
edge = await freshEdge();
out = await hitEdge(edge, "8.8.8.8");
ok("API unreachable and nothing remembered -> FAIL CLOSED (blocked)", out.allowed === false && out.status === 403);
ok("…but office IPs still get in", (await hitEdge(edge, "103.217.245.94")).allowed === true);
fetchMode = "api";
edge = await freshEdge();
await hitEdge(edge, "203.0.113.7");                       // loads and remembers the list
const realNow = Date.now;
Date.now = () => realNow() + 61_000;                       // a minute later the cache is stale...
fetchMode = "throw";                                       // ...and the API is down
ok("API down after a good load -> keeps using the remembered list (listed IP in)", (await hitEdge(edge, "203.0.113.7")).allowed === true);
ok("…and still blocks unlisted IPs", (await hitEdge(edge, "8.8.8.8")).allowed === false);
Date.now = () => realNow() + 23 * 3600_000;                // 23 hours into the outage...
ok("still using the remembered list 23 hours into an outage (listed IP in)", (await hitEdge(edge, "203.0.113.7")).allowed === true);
Date.now = () => realNow() + 25 * 3600_000;                // ...but a list over a day old is no longer trusted
out = await hitEdge(edge, "203.0.113.7");
ok("a list older than 24 hours is no longer trusted -> blocked", out.allowed === false);
Date.now = realNow;
for (const status of [401, 403, 404, 503]) {
  fetchMode = status;
  edge = await freshEdge();
  ok(`API answers ${status} (not set up / not deployed) -> filter does nothing, everyone gets in`, (await hitEdge(edge, "8.8.8.8")).allowed === true);
}
fetchMode = 500;
edge = await freshEdge();
ok("API answers 500 -> treated as unreachable -> blocked", (await hitEdge(edge, "8.8.8.8")).allowed === false);
fetchMode = "api";

globalThis.fetch = realFetch;
for (const { name } of await db.listCollections().toArray()) await db.collection(name).deleteMany({});
await closeDb();
console.log(`\n${fail === 0 ? "ALL PASSED" : fail + " FAILED"}  (${pass} passed)`);
process.exit(fail ? 1 : 0);
