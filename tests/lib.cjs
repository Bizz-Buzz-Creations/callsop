// Shared helpers for the browser (Playwright) tests. See tests/README.md.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createRequire } = require("module");

const ROOT = path.resolve(__dirname, "..");
const req = createRequire(path.join(ROOT, "package.json"));
const { MongoClient } = req("mongodb");

const MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/";
const DB = process.env.TEST_DB || "callsop_e2e";
const BASE = process.env.TEST_BASE_URL || "http://localhost:4320";
const API = process.env.TEST_API_URL || "http://localhost:8788/api";

// These tests wipe collections. Never let them near a real database.
if (!/^callsop_(e2e|test)/.test(DB)) {
  throw new Error(`Refusing to run: TEST_DB must start with "callsop_e2e" or "callsop_test" (got "${DB}").`);
}

const bank = req(path.join(ROOT, "src/assets/mcqTest.json")).questions;
const rebuttals = req(path.join(ROOT, "src/assets/rebuttals.json"));
const pitch = req(path.join(ROOT, "src/assets/pitch.json"));

// ---- tiny test runner ---------------------------------------------------------------
const createRunner = () => {
  let pass = 0, fail = 0;
  return {
    ok(name, cond, extra = "") {
      cond ? pass++ : fail++;
      console.log(`  ${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + extra}`);
    },
    async group(title, fn) {
      console.log(`\n== ${title} ==`);
      try { await fn(); } catch (e) { fail++; console.log(`  FAIL  [group crashed] ${String(e.message).split("\n")[0]}`); }
    },
    finish(browser) {
      console.log(`\n${fail === 0 ? "ALL PASSED" : fail + " FAILED"}  (${pass} passed)`);
      return (browser ? browser.close() : Promise.resolve()).finally(() => process.exit(fail ? 1 : 0));
    },
  };
};

// ---- browser ------------------------------------------------------------------------
const findChromium = () => {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const dir = path.join(os.homedir(), ".cache/ms-playwright");
  if (!fs.existsSync(dir)) return undefined; // fall back to Playwright's own download
  const found = fs.readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()
    .map((d) => path.join(dir, d, "chrome-linux64/chrome")).find((p) => fs.existsSync(p));
  return found;
};
const launch = () => req("playwright-core").chromium.launch({ executablePath: findChromium(), headless: true });

// ---- database + API helpers ----------------------------------------------------------
const withDb = async (fn) => {
  const client = await new MongoClient(MONGO_URI).connect();
  try { return await fn(client.db(DB)); } finally { await client.close(); }
};

// Empties every collection but keeps indexes (the running API has cached them).
const reset = () => withDb(async (db) => {
  for (const n of ["admins", "config", "questions", "attempts", "violations", "loginFailures", "counters"]) await db.collection(n).deleteMany({});
});

const seedAdmin = async (email, password) => {
  const { hashPassword } = await import(`file://${ROOT}/netlify/api/security.js`);
  const passwordHash = await hashPassword(password);
  await withDb((db) => db.collection("admins").insertOne({ email, passwordHash, createdAt: new Date() }));
};

const api = async (method, p, { token, body } = {}) => {
  const res = await fetch(API + p, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const adminToken = async (email, password) => (await api("POST", "/admin/login", { body: { email, password } })).data.token;
const seedQuestions = (token) => api("POST", "/admin/questions/import", { token, body: { mode: "replace", questions: bank.map(({ section, question, options, answer }) => ({ section, question, options, answer })) } });
const setConfig = (token, config) => api("PUT", "/admin/config", { token, body: config });

// Questions are shuffled on every page load, so tests find each one by its text.
// displayOrder(page) -> bank index of each question, in the order shown.
const displayOrder = async (page) => {
  const texts = await page.locator("fieldset p.font-medium").allInnerTexts();
  return texts.map((t) => bank.findIndex((q) => q.question === t.replace(/^\d+\.\s*/, "").trim()));
};
// Choose option `letterIdx` (0 = A) for bank question `bankIdx`, wherever it is shown.
const answerBank = (page, order, bankIdx, letterIdx) =>
  page.locator("fieldset").nth(order.indexOf(bankIdx)).locator('input[type="radio"]').nth(letterIdx).check();

// Abort unless the API being tested really uses the throwaway database: the admin
// just seeded into it must be able to log in. If the API pointed at a real
// database (a dev server on the wrong port, say), that login would fail.
const requireTestApi = async (email, password) => {
  const token = await adminToken(email, password);
  if (!token) throw new Error(`ABORTED: the API at ${API} does not use the test database (seeded admin cannot log in). Nothing was changed.`);
  return token;
};

module.exports = { requireTestApi, displayOrder, answerBank, ROOT, BASE, API, MONGO_URI, DB, bank, rebuttals, pitch, createRunner, launch, withDb, reset, seedAdmin, api, adminToken, seedQuestions, setConfig };
