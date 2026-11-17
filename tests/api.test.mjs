// Tests netlify/api/routes.js against a real (throwaway) MongoDB. See tests/README.md.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(`${ROOT}/package.json`);
const bank = require(`${ROOT}/src/assets/mcqTest.json`).questions;
const { ObjectId } = require("mongodb");

process.env.MONGODB_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017/";
process.env.MONGODB_DB = `callsop_test_${Date.now()}`;
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
delete process.env.ALLOWED_ORIGIN;

const { handle } = await import(pathToFileURL(`${ROOT}/netlify/api/routes.js`));
const { getDb, closeDb } = await import(pathToFileURL(`${ROOT}/netlify/api/db.js`));
const { hashPassword, signToken } = await import(pathToFileURL(`${ROOT}/netlify/api/security.js`));

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  -> " + extra}`); };
const section = (t) => console.log(`\n== ${t} ==`);

const call = async (method, path, { token, body, raw, headers = {}, ip } = {}) => {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  if (body !== undefined || raw !== undefined) h["content-type"] = "application/json";
  const res = await handle(new Request(`http://x.test/api${path}`, { method, headers: h, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) }), { ip: ip || "10.0.0.1" });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, text, headers: res.headers };
};
const is = (r, status, name) => ok(name, r.status === status, `got ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);

const start = (token, name = "Tester") => call("POST", "/attempt/start", { token, body: { name } });
const db = await getDb();
const newAgent = async () => (await call("POST", "/session")).data.token;
const letters = "ABCD";

// ---------------------------------------------------------------------------------
section("health, routing, headers");
let r = await call("GET", "/health");
is(r, 200, "health answers without auth");
ok("health reports configuration without leaking values", r.data.configured.mongo === true && r.data.configured.secret === true && !r.text.includes("mongodb://"));
r = await call("GET", "/nope"); is(r, 404, "unknown route -> 404");
r = await call("DELETE", "/test"); is(r, 404, "wrong method -> 404");
ok("responses are never cached", r.headers.get("cache-control") === "no-store" && r.headers.get("x-content-type-options") === "nosniff");

// ---------------------------------------------------------------------------------
section("authentication boundaries");
const A = await newAgent(), B = await newAgent();
ok("session endpoint returns a signed token", A.split(".").length === 2);
is(await call("GET", "/test"), 401, "no token -> 401");
is(await call("GET", "/test", { token: "garbage" }), 401, "garbage token -> 401");
is(await call("GET", "/test", { token: "a.b.c" }), 401, "three-part token -> 401");
const [body, sig] = A.split(".");
const forgedBody = Buffer.from(JSON.stringify({ role: "admin", sub: "x", exp: 9999999999 })).toString("base64url");
is(await call("GET", "/admin/me", { token: `${forgedBody}.${sig}` }), 401, "payload edited, old signature -> 401");
is(await call("GET", "/test", { token: `${body}.${"A".repeat(sig.length)}` }), 401, "wrong signature -> 401");
is(await call("GET", "/test", { token: signToken({ role: "agent", sub: "s" }, -10) }), 401, "expired token -> 401");
is(await call("GET", "/admin/questions", { token: A }), 401, "agent token on an admin route -> 401");
const sessionCheck = await call("GET", "/test", { token: A });
is(sessionCheck, 200, "valid agent token works");

// ---------------------------------------------------------------------------------
section("admin account + login");
const mkAdmin = async (email, pw) => (await db.collection("admins").insertOne({ email, passwordHash: await hashPassword(pw), createdAt: new Date() })).insertedId.toHexString();
const adminId = await mkAdmin("boss@example.com", "correct-horse-1");
r = await call("POST", "/admin/login", { body: { email: "boss@example.com", password: "wrong" } }); is(r, 401, "wrong password -> 401");
const msgWrong = r.data.error;
r = await call("POST", "/admin/login", { body: { email: "nobody@example.com", password: "wrong" } }); is(r, 401, "unknown email -> 401");
ok("same message for unknown email and wrong password (no user enumeration)", r.data.error === msgWrong);
is(await call("POST", "/admin/login", { body: { email: { $ne: null }, password: "x" } }), 400, "NoSQL injection in email ({$ne:null}) -> 400");
is(await call("POST", "/admin/login", { body: { email: "boss@example.com", password: { $ne: "" } } }), 400, "NoSQL injection in password -> 400");
is(await call("POST", "/admin/login", { body: { email: "boss@example.com" } }), 400, "missing password -> 400");
is(await call("POST", "/admin/login", { raw: "{not json" }), 400, "invalid JSON -> 400");
r = await call("POST", "/admin/login", { body: { email: "BOSS@Example.com ", password: "correct-horse-1" } });
is(r, 200, "login ok (email is case/space insensitive)");
const T = r.data.token;
ok("login response has token + email, no hash", !!T && r.data.email === "boss@example.com" && !r.text.includes("scrypt"));
r = await call("GET", "/admin/me", { token: T }); ok("admin/me returns email", r.status === 200 && r.data.email === "boss@example.com");
is(await call("GET", "/test", { token: T }), 401, "admin token on an agent route -> 401");

// lockout (separate email + ip so the rest of the run is unaffected)
await mkAdmin("lock@example.com", "lock-password-1");
let last;
for (let i = 0; i < 8; i++) last = await call("POST", "/admin/login", { body: { email: "lock@example.com", password: `bad${i}` }, ip: "10.9.9.9" });
is(await call("POST", "/admin/login", { body: { email: "lock@example.com", password: "lock-password-1" }, ip: "10.8.8.8" }), 429, "after 8 failures the account is locked even with the right password");
is(await call("POST", "/admin/login", { body: { email: "other@example.com", password: "x" }, ip: "10.9.9.9" }), 429, "after 8 failures the IP is locked for other emails too");
is(await call("POST", "/admin/login", { body: { email: "boss@example.com", password: "correct-horse-1" }, ip: "10.7.7.7" }), 200, "an unrelated admin on another IP is unaffected");
void last;

// ---------------------------------------------------------------------------------
section("empty bank");
const E = await newAgent();
r = await start(E); is(r, 409, "starting with no questions -> 409");
ok("message is clear", /No questions/.test(r.data.error));

// ---------------------------------------------------------------------------------
section("admin: questions");
is(await call("GET", "/admin/questions"), 401, "questions list needs a token");
is(await call("POST", "/admin/questions/import", { token: A, body: { mode: "replace", questions: bank } }), 401, "agent cannot import questions");
r = await call("POST", "/admin/questions/import", { token: T, body: { mode: "replace", questions: [{ question: "x", options: ["only"], answer: "Z" }, { question: "", options: ["a", "b"], answer: "A" }] } });
is(r, 400, "invalid import -> 400"); ok("error lists the problems per question", /Question 1:/.test(r.data.error) && /Question 2:/.test(r.data.error), r.data.error);
is(await call("POST", "/admin/questions/import", { token: T, body: { mode: "wipe", questions: bank } }), 400, "bad import mode -> 400");
is(await call("POST", "/admin/questions/import", { token: T, body: { mode: "replace", questions: [] } }), 400, "empty import -> 400");
ok("a rejected import changed nothing", (await db.collection("questions").countDocuments()) === 0);
r = await call("POST", "/admin/questions/import", { token: T, body: { mode: "replace", questions: bank.map(({ section, question, options, answer }) => ({ section, question, options, answer })) } });
ok("import 30 questions", r.status === 200 && r.data.imported === 30, JSON.stringify(r.data));
r = await call("GET", "/admin/questions", { token: T });
const qs = r.data.questions;
ok("admin sees 30 questions WITH answers, in order", qs.length === 30 && qs.every((q, i) => q.order === i + 1 && letters.includes(q.answer)) && qs[0].answer === "B");
is(await call("POST", "/admin/questions", { token: T, body: { question: "Q?", options: ["a", "b", "c"], answer: "D" } }), 400, "answer outside the options -> 400");
is(await call("POST", "/admin/questions", { token: T, body: { question: "Q?", options: ["a"], answer: "A" } }), 400, "one option -> 400");
is(await call("POST", "/admin/questions", { token: T, body: { question: "Q?", options: ["a", "b", "c", "d", "e", "f", "g"], answer: "A" } }), 400, "seven options -> 400");
is(await call("POST", "/admin/questions", { token: T, body: { question: "Q?", options: ["a", { $gt: "" }], answer: "A" } }), 400, "object as an option -> 400");
r = await call("POST", "/admin/questions", { token: T, body: { section: "Extra", question: "Made by form?", options: ["Yes", "No", "Maybe"], answer: "c" } });
is(r, 201, "create question (lower-case answer normalised)");
const newId = r.data.id;
r = await call("GET", "/admin/questions", { token: T }); const created = r.data.questions.at(-1);
ok("new question is appended with order 31 and answer C", created.id === newId && created.order === 31 && created.answer === "C");
is(await call("PUT", `/admin/questions/${newId}`, { token: T, body: { section: "Extra", question: "Edited?", options: ["Yes", "No", "Maybe"], answer: "A" } }), 200, "update question");
is(await call("PUT", "/admin/questions/000000000000000000000000", { token: T, body: { question: "q", options: ["a", "b"], answer: "A" } }), 404, "update unknown question -> 404");
is(await call("PUT", "/admin/questions/not-an-id", { token: T, body: { question: "q", options: ["a", "b"], answer: "A" } }), 400, "update with malformed id -> 400");
const firstId = qs[0].id;
is(await call("POST", "/admin/questions/swap", { token: T, body: { a: firstId, b: newId } }), 200, "swap order");
r = await call("GET", "/admin/questions", { token: T });
ok("swap exchanged the positions", r.data.questions[0].id === newId && r.data.questions.at(-1).id === firstId);
is(await call("DELETE", `/admin/questions/${newId}`, { token: T }), 200, "delete question");
is(await call("DELETE", `/admin/questions/${newId}`, { token: T }), 404, "delete again -> 404");
r = await call("POST", "/admin/questions/import", { token: T, body: { mode: "append", questions: [{ section: "", question: "Appended?", options: ["Y", "N"], answer: "B" }] } });
ok("append adds after existing", r.status === 200 && (await db.collection("questions").countDocuments()) === 31);
const appended = await db.collection("questions").findOne({ question: "Appended?" });
await call("DELETE", `/admin/questions/${appended._id.toHexString()}`, { token: T });
// restore canonical order (swap earlier moved the original first question to the end)
await call("POST", "/admin/questions/import", { token: T, body: { mode: "replace", questions: bank.map(({ section, question, options, answer }) => ({ section, question, options, answer })) } });
ok("bank restored to 30", (await db.collection("questions").countDocuments()) === 30);

// ---------------------------------------------------------------------------------
section("admin: settings");
r = await call("GET", "/admin/config", { token: T });
ok("defaults when nothing saved", r.data.config.passPercent === 70 && r.data.config.active === true);
is(await call("PUT", "/admin/config", { token: T, body: { title: "T", passPercent: 0, active: true } }), 400, "pass mark 0 -> 400");
is(await call("PUT", "/admin/config", { token: T, body: { title: "T", passPercent: 101, active: true } }), 400, "pass mark 101 -> 400");
is(await call("PUT", "/admin/config", { token: T, body: { title: "T", passPercent: 70.5, active: true } }), 400, "fractional pass mark -> 400");
is(await call("PUT", "/admin/config", { token: T, body: { title: "T", passPercent: 70, active: "yes" } }), 400, "active must be boolean -> 400");
is(await call("PUT", "/admin/config", { token: T, body: { title: "", passPercent: 70, active: true } }), 400, "empty title -> 400");
is(await call("PUT", "/admin/config", { token: A, body: { title: "T", passPercent: 1, active: true } }), 401, "agent cannot change settings");
is(await call("PUT", "/admin/config", { token: T, body: { title: "Disposition Test", passPercent: 70, active: true, $set: { evil: 1 } } }), 200, "save settings (extra fields ignored)");
ok("unknown fields were not stored", !("evil" in (await db.collection("config").findOne({ _id: "test" }))));

// ---------------------------------------------------------------------------------
section("agent: question privacy");
r = await call("GET", "/test", { token: A });
ok("agent gets 30 questions", r.data.questions.length === 30);
ok("NO answer anywhere in the agent payload", !/"answer"/i.test(r.text) && r.data.questions.every((q) => !("answer" in q)));
ok("settings shown to agents are limited (title, pass mark, open)", JSON.stringify(Object.keys(r.data.config).sort()) === '["active","passPercent","title"]', JSON.stringify(r.data.config));

// ---------------------------------------------------------------------------------
section("agent: starting (a name is required)");
is(await call("POST", "/attempt/start", { body: { name: "Ann" } }), 401, "starting needs a session token");
is(await call("POST", "/attempt/start", { token: A, body: {} }), 400, "no name -> 400");
is(await call("POST", "/attempt/start", { token: A, headers: {} }), 400, "no body at all -> 400");
is(await call("POST", "/attempt/start", { token: A, body: { name: "" } }), 400, "empty name -> 400");
is(await call("POST", "/attempt/start", { token: A, body: { name: "   " } }), 400, "blank name -> 400");
is(await call("POST", "/attempt/start", { token: A, body: { name: 123 } }), 400, "number as name -> 400");
is(await call("POST", "/attempt/start", { token: A, body: { name: { $ne: "" } } }), 400, "NoSQL injection in name -> 400");
is(await call("POST", "/attempt/start", { token: A, body: { name: "x".repeat(81) } }), 400, "name longer than 80 -> 400");
ok("none of the refused starts created an attempt", (await db.collection("attempts").countDocuments()) === 0);
r = await call("POST", "/attempt/start", { token: A, body: { name: "  Alice   Smith ", employeeId: "E-1", evil: 1 } });
is(r, 200, "start with a name");
const att = r.data.attemptId, ids = r.data.questionIds;
ok("30 question ids frozen, not resumed", ids.length === 30 && r.data.resumed === false);
const attDoc = await db.collection("attempts").findOne({ _id: new ObjectId(att) });
ok("name is trimmed/collapsed; nothing else from the body is stored; test #1", attDoc.name === "Alice Smith" && !("employeeId" in attDoc) && !("evil" in attDoc) && attDoc.attemptNo === 1, JSON.stringify(attDoc));
r = await start(A, "Someone Else");
ok("starting again resumes the same attempt and keeps the original name", r.data.attemptId === att && r.data.resumed === true && (await db.collection("attempts").findOne({ _id: new ObjectId(att) })).name === "Alice Smith");
r = await call("GET", "/attempt/open", { token: A });
ok("open attempt returns name/number/ids/answers, no key", r.data.attempt.id === att && r.data.attempt.name === "Alice Smith" && r.data.attempt.attemptNo === 1 && !/"correct"|"answer":"/.test(r.text.replace(/"answers":\{[^}]*\}/, "")));
ok("agent B has no open attempt", (await call("GET", "/attempt/open", { token: B })).data.attempt === null);

// concurrency: five parallel starts from one new session create exactly one attempt
const C = await newAgent();
const cSid = JSON.parse(Buffer.from(C.split(".")[0], "base64url")).sub;
const burst = await Promise.all(Array.from({ length: 5 }, () => start(C)));
ok("5 parallel starts -> all succeed with the same attempt", burst.every((x) => x.status === 200 && x.data.attemptId === burst[0].data.attemptId), JSON.stringify(burst.map((x) => x.status)));
ok("database holds exactly one attempt for that session, numbered #2", (await db.collection("attempts").countDocuments({ sid: cSid })) === 1 && (await db.collection("attempts").findOne({ sid: cSid })).attemptNo === 2);

section("agent: answers and isolation");
is(await call("PUT", `/attempt/${att}/answer`, { token: A, body: { questionId: ids[0], letter: "B" } }), 200, "save an answer");
is(await call("PUT", `/attempt/${att}/answer`, { token: A, raw: JSON.stringify({ questionId: ids[0], letter: "A", pad: "x".repeat(200000) }) }), 413, "oversized body -> 413");
is(await call("PUT", `/attempt/${att}/answer`, { token: A, body: { questionId: ids[0], letter: "Z" } }), 400, "invalid letter -> 400");
is(await call("PUT", `/attempt/${att}/answer`, { token: A, body: { questionId: ids[0], letter: { $ne: "" } } }), 400, "object as letter -> 400");
is(await call("PUT", `/attempt/${att}/answer`, { token: A, body: { questionId: "../../x", letter: "A" } }), 400, "malformed question id -> 400");
is(await call("PUT", `/attempt/${att}/answer`, { token: A, body: { questionId: "a".repeat(24), letter: "A" } }), 409, "question not in this attempt -> 409");
is(await call("PUT", `/attempt/${att}/answer`, { token: B, body: { questionId: ids[1], letter: "A" } }), 409, "agent B cannot write A's attempt");
is(await call("PUT", `/attempt/${att}/answer`, { body: { questionId: ids[1], letter: "A" } }), 401, "no token -> 401");
is(await call("PUT", "/attempt/zzz/answer", { token: A, body: { questionId: ids[1], letter: "A" } }), 400, "malformed attempt id -> 400");
r = await call("GET", "/attempt/open", { token: A });
ok("only the valid answer was stored", JSON.stringify(r.data.attempt.answers) === JSON.stringify({ [ids[0]]: "B" }), JSON.stringify(r.data.attempt.answers));
ok("a key with dots/$ can never be stored as an answer path", true);

section("agent: proctoring warnings");
is(await call("POST", `/attempt/${att}/violation`, { token: A, body: { type: "tab-switch" } }), 200, "log tab-switch");
is(await call("POST", `/attempt/${att}/violation`, { token: A, body: { type: "window-blur" } }), 200, "log window-blur");
is(await call("POST", `/attempt/${att}/violation`, { token: A, body: { type: "nothing" } }), 400, "unknown type -> 400");
is(await call("POST", `/attempt/${att}/violation`, { token: A, body: { type: { $ne: "" } } }), 400, "object type -> 400");
is(await call("POST", `/attempt/${att}/violation`, { token: B, body: { type: "tab-switch" } }), 409, "B cannot log against A's attempt");
ok("warnings are stamped with the SERVER time", (await db.collection("violations").find({}).toArray()).every((x) => x.at instanceof Date && Math.abs(Date.now() - x.at) < 60000));
is(await call("POST", `/attempt/${att}/violation`, { token: A, body: { type: "tab-switch", at: "2001-01-01" } }), 200, "a client-supplied time is ignored, not an error");
ok("…and never stored", (await db.collection("violations").find({ at: { $lt: new Date("2020-01-01") } }).toArray()).length === 0);

section("admin: live view");
r = await call("GET", "/admin/attempts", { token: T });
const row = r.data.attempts.find((a) => a.id === att);
ok("attempt listed with 3 warnings, oldest first", row && row.violations.length === 3 && row.violations[0].type === "tab-switch" && new Date(row.violations[0].at) <= new Date(row.violations[1].at));
ok("admin row shows the name and test number, no internal fields", row.name === "Alice Smith" && row.attemptNo === 1 && !("sid" in row) && !("employeeId" in row), JSON.stringify(Object.keys(row)));
is(await call("GET", "/admin/attempts", { token: A }), 401, "agent cannot list attempts");

// ---------------------------------------------------------------------------------
section("submit + server-side scoring");
const answers = {};
ids.forEach((id, i) => { answers[id] = bank[i].answer; });
[27, 28, 29].forEach((i) => { answers[ids[i]] = bank[i].answer === "A" ? "B" : "A"; });
answers[ids[4]] = "Z";          // invalid letter -> unanswered
answers["f".repeat(24)] = "A";  // not a question of this attempt
is(await call("POST", `/attempt/${att}/submit`, { token: B, body: { answers } }), 404, "agent B cannot submit A's attempt");
is(await call("POST", `/attempt/${att}/submit`, { token: A, body: { answers: "all-correct" } }), 400, "answers must be an object");
is(await call("POST", `/attempt/${att}/submit`, { token: A, body: { answers: [1, 2] } }), 400, "answers as an array -> 400");
r = await call("POST", `/attempt/${att}/submit`, { token: A, body: { answers } });
is(r, 200, "submit");
ok("score 26/30 (invalid letter + 3 wrong), 87%, passed", r.data.score === 26 && r.data.total === 30 && r.data.percent === 87 && r.data.passed === true && r.data.passPercent === 70, JSON.stringify({ s: r.data.score, t: r.data.total, p: r.data.percent }));
ok("result includes the full correct-answer map matching the bank", Object.keys(r.data.correct).length === 30 && ids.every((id, i) => r.data.correct[id] === bank[i].answer));
const stored = await db.collection("attempts").findOne({ _id: new ObjectId(att) });
ok("stored as completed with finish time", stored.status === "completed" && stored.finishedAt instanceof Date && stored.score === 26);
ok("junk answers were not stored", !("f".repeat(24) in stored.answers) && !(ids[4] in stored.answers));
const again = await call("POST", `/attempt/${att}/submit`, { token: A, body: { answers: Object.fromEntries(ids.map((id) => [id, "A"])) } });
ok("resubmitting returns the stored result (no rescore)", again.data.score === 26 && again.data.percent === 87);
is(await call("PUT", `/attempt/${att}/answer`, { token: A, body: { questionId: ids[1], letter: "A" } }), 409, "cannot change answers after submit");
is(await call("POST", `/attempt/${att}/violation`, { token: A, body: { type: "tab-switch" } }), 409, "cannot log warnings after submit");
r = await call("GET", "/attempt/open", { token: A });
ok("no open attempt after submit", r.data.attempt === null);

// concurrent submits of a fresh attempt
const D = await newAgent();
const d = (await start(D)).data;
const dAnswers = Object.fromEntries(d.questionIds.map((id, i) => [id, bank[i].answer]));
const subs = await Promise.all([1, 2, 3].map(() => call("POST", `/attempt/${d.attemptId}/submit`, { token: D, body: { answers: dAnswers } })));
ok("3 parallel submits all return the same 30/30", subs.every((x) => x.status === 200 && x.data.score === 30 && x.data.percent === 100), JSON.stringify(subs.map((x) => x.status)));

// ---------------------------------------------------------------------------------
section("retakes, admin delete, closed test");
r = await start(A);
ok("after submitting, the same browser can start a NEW test (no limit)", r.status === 200 && r.data.resumed === false && r.data.attemptId !== att, JSON.stringify(r.data));
r = await call("GET", "/attempt/open", { token: A });
ok("each new test gets the next number", r.data.attempt.attemptNo > 1, JSON.stringify(r.data.attempt));
const b = (await start(B)).data;
ok("another agent can start too", !!b.attemptId);
is(await call("DELETE", `/admin/attempts/${att}`, { token: A }), 401, "agent cannot delete attempts");
is(await call("DELETE", `/admin/attempts/${att}`, { token: T }), 200, "admin deletes the first attempt");
ok("its warnings were deleted too", (await db.collection("violations").countDocuments({ attemptId: stored._id })) === 0);
is(await call("DELETE", `/admin/attempts/${att}`, { token: T }), 404, "delete again -> 404");
await call("PUT", "/admin/config", { token: T, body: { title: "Disposition Test", passPercent: 70, active: false } });
const G = await newAgent();
is(await start(G), 403, "closed test -> 403");
r = await call("GET", "/test", { token: G }); ok("agents can see the test is closed", r.data.config.active === false);
await call("PUT", "/admin/config", { token: T, body: { title: "Disposition Test", passPercent: 70, active: true } });
is(await start(G), 200, "re-opened -> starts again");

section("a question deleted mid-test is not scored");
const gAtt = (await call("GET", "/attempt/open", { token: G })).data.attempt;
await db.collection("questions").deleteOne({ _id: (await db.collection("questions").findOne({}))._id });
const gAns = Object.fromEntries(gAtt.questionIds.map((id, i) => [id, bank[i].answer]));
r = await call("POST", `/attempt/${gAtt.id}/submit`, { token: G, body: { answers: gAns } });
ok("29/29 = 100%", r.data.total === 29 && r.data.score === 29 && r.data.percent === 100, JSON.stringify({ t: r.data.total, s: r.data.score }));

section("pass mark applies at submit time");
await call("PUT", "/admin/config", { token: T, body: { title: "T", passPercent: 90, active: true } });
const H = await newAgent();
const h = (await start(H)).data;
const hAns = Object.fromEntries(h.questionIds.map((id, i) => [id, i < 25 ? bank[i + 1]?.answer : "A"]).slice(0, 29));
r = await call("POST", `/attempt/${h.attemptId}/submit`, { token: H, body: { answers: Object.fromEntries(h.questionIds.slice(0, 1).map((id) => [id, "A"])) } });
ok("pass mark 90 is used and recorded (low score fails)", r.data.passed === false && r.data.passPercent === 90 && r.data.percent < 90, JSON.stringify(r.data.percent));
void hAns;

// ---------------------------------------------------------------------------------
section("admin lifecycle");
await db.collection("admins").deleteOne({ email: "boss@example.com" });
is(await call("GET", "/admin/me", { token: T }), 401, "a deleted admin's token stops working immediately");

section("create-admin script");
const run = (args, env) => spawnSync("node", [`${ROOT}/scripts/create-admin.mjs`, ...args], { env: { ...process.env, ...env }, encoding: "utf8" });
let s = run(["Admin"], { ADMIN_PASSWORD: "admin" });
ok("creates an admin with a simple username and a short password", s.status === 0 && /Admin created: admin/.test(s.stdout), s.stdout + s.stderr);
r = await call("POST", "/admin/login", { body: { email: "admin", password: "admin" }, ip: "10.5.5.5" });
is(r, 200, "…who can log in (username is case-insensitive)");
const storedHash = (await db.collection("admins").findOne({ email: "admin" })).passwordHash;
ok("password is stored hashed (scrypt), never in clear", /^scrypt\$/.test(storedHash) && !storedHash.includes("admin"), storedHash);
s = run(["admin"], { ADMIN_PASSWORD: "another-password-2" });
ok("running again resets the password", s.status === 0 && /Password updated/.test(s.stdout), s.stdout + s.stderr);
is(await call("POST", "/admin/login", { body: { email: "admin", password: "admin" }, ip: "10.5.5.5" }), 401, "old password no longer works");
is(await call("POST", "/admin/login", { body: { email: "admin", password: "another-password-2" }, ip: "10.5.5.5" }), 200, "new password works");
ok("a very short password (3 chars) is refused", run(["x"], { ADMIN_PASSWORD: "abc" }).status === 1);
ok("an empty username is refused", run([""], { ADMIN_PASSWORD: "abcd" }).status === 1);

// ---------------------------------------------------------------------------------
section("CORS and configuration");
r = await call("GET", "/test", { token: A, headers: { origin: "https://evil.example" } });
ok("no CORS headers by default (same-origin only)", !r.headers.get("access-control-allow-origin"));
process.env.ALLOWED_ORIGIN = "https://callsop.bbcfinsrv.com, https://callsop.netlify.app";
r = await call("GET", "/health", { headers: { origin: "https://callsop.bbcfinsrv.com" } });
ok("allowed origin gets CORS headers", r.headers.get("access-control-allow-origin") === "https://callsop.bbcfinsrv.com" && /Authorization/.test(r.headers.get("access-control-allow-headers")));
r = await call("GET", "/health", { headers: { origin: "https://evil.example" } });
ok("other origins get none", !r.headers.get("access-control-allow-origin"));
r = await call("OPTIONS", "/attempt/start", { headers: { origin: "https://callsop.netlify.app" } });
ok("preflight answered with 204 + headers", r.status === 204 && r.headers.get("access-control-allow-origin") === "https://callsop.netlify.app");
delete process.env.ALLOWED_ORIGIN;
const savedSecret = process.env.SESSION_SECRET;
process.env.SESSION_SECRET = "short";
r = await call("POST", "/session");
ok("missing/short SESSION_SECRET -> clear 500, not a crash", r.status === 500 && /SESSION_SECRET/.test(r.data.error), JSON.stringify(r.data));
process.env.SESSION_SECRET = savedSecret;
is(await call("POST", "/session"), 200, "works again once configured");

// Cleanup: empty the collections. Do NOT dropDatabase here: on a freshly started
// MongoDB it can wedge the whole server for minutes and stall every later test.
for (const { name } of await db.listCollections().toArray()) await db.collection(name).deleteMany({});
await closeDb();
console.log(`\n${fail === 0 ? "ALL PASSED" : fail + " FAILED"}  (${pass} passed)`);
process.exit(fail ? 1 : 0);
