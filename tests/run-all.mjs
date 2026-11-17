// `npm test`: starts a throwaway MongoDB, the API and a build of the site, runs
// every suite, then shuts everything down. See tests/README.md.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "package.json"));
const VITE = join(ROOT, "node_modules/vite/bin/vite.js");
// Free ports chosen at run time, so these tests can never collide with (and
// accidentally talk to) a dev server you already have running, for example your
// `npm run dev:api` that is connected to your real database.
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
const API_PORT = await freePort();
const WEB_PORT = await freePort();
const tmp = mkdtempSync(join(tmpdir(), "callsop-tests-"));
const children = [];
let mongod;

const cleanup = async () => {
  children.forEach((c) => c.kill());
  if (mongod) await mongod.stop();
  rmSync(tmp, { recursive: true, force: true });
};

const waitFor = async (url, what) => {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} did not start (${url})`);
};

// The throwaway database sometimes stops answering for a while after a heavy suite.
// Wait for it (and say how long) instead of letting the next suite time out.
const waitForMongo = async (uri, label) => {
  const { MongoClient } = require("mongodb");
  const started = Date.now();
  for (let attempt = 0; attempt < 45; attempt++) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 });
    try {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      const seconds = (Date.now() - started) / 1000;
      if (seconds > 3) console.log(`(the database needed ${seconds.toFixed(1)}s to answer before: ${label})`);
      return;
    } catch {
      // not answering yet
    } finally {
      await client.close().catch(() => {});
    }
  }
  throw new Error(`the test database stopped answering before: ${label}`);
};

const failures = [];
const run = async (label, args, env) => {
  await waitForMongo(env.TEST_MONGO_URI, label);
  console.log(`\n################ ${label} ################`);
  const res = spawnSync(process.execPath, args, { cwd: ROOT, env, stdio: "inherit" });
  if (res.status !== 0) failures.push(label);
};

try {
  // 1. MongoDB: your own (TEST_MONGO_URI) or a throwaway in-memory one.
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    // MongoDB publishes no build for the newest Ubuntu releases; the 22.04 build runs on them.
    if (process.platform === "linux" && !process.env.MONGOMS_DOWNLOAD_URL && !process.env.MONGOMS_SYSTEM_BINARY) {
      process.env.MONGOMS_DOWNLOAD_URL = "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-7.0.14.tgz";
      process.env.MONGOMS_VERSION = "7.0.14";
    }
    console.log("Starting a throwaway MongoDB (the first run downloads ~80 MB)...");
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  }
  const env = {
    ...process.env,
    TEST_MONGO_URI: uri,
    MONGODB_URI: uri,
    MONGODB_DB: "callsop_e2e",
    SESSION_SECRET: "test-secret-test-secret-test-secret-test-1234",
    API_PORT: String(API_PORT), // read by scripts/dev-api.mjs and vite.config.js
    TEST_API_URL: `http://localhost:${API_PORT}/api`,
    TEST_BASE_URL: `http://localhost:${WEB_PORT}`,
  };

  // 2. Tests that need no browser
  await run("API (netlify/api against MongoDB)", ["tests/api.test.mjs"], env);
  await run("IP access control (API + edge function)", ["tests/access.test.mjs"], env);

  // 3. Build the site into a temp folder (your dist/ is never touched)
  console.log("\nBuilding the site for the browser tests...");
  const dist = join(tmp, "dist");
  const build = spawnSync(process.execPath, [VITE, "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, env, stdio: "ignore" });
  if (build.status !== 0) throw new Error("vite build failed (run `npm run build` to see why)");

  // 4. Servers
  children.push(spawn(process.execPath, ["scripts/dev-api.mjs"], { cwd: ROOT, env, stdio: "ignore" }));
  children.push(spawn(process.execPath, [VITE, "preview", "--outDir", dist, "--port", String(WEB_PORT), "--strictPort"], { cwd: ROOT, env, stdio: "ignore" }));
  await waitFor(`http://localhost:${API_PORT}/api/health`, "the API");
  await waitFor(`http://localhost:${WEB_PORT}/api/health`, "the website");

  // 5. Browser suites
  await run("Whole app (SOP, report, dialog, calculator)", ["tests/app.e2e.cjs"], env);
  await run("MCQ test + admin panel", ["tests/mcq.e2e.cjs"], env);
  await run("MCQ edge cases", ["tests/mcq-extra.e2e.cjs"], env);
  await run("Admin: IP access tab", ["tests/access.e2e.cjs"], env);
} catch (err) {
  console.error(`\n${err.message}`);
  failures.push("setup");
} finally {
  await cleanup();
}

console.log(failures.length ? `\nFAILED: ${failures.join(", ")}` : "\nEVERYTHING PASSED");
process.exit(failures.length ? 1 : 0);
