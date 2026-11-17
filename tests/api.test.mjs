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
const { getDb, closeDb, migrateToMultipleTests, LEGACY_TEST_ID } = await import(pathToFileURL(`${ROOT}/netlify/api/db.js`));
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

let TID; // id of the main test, set once it is created
const start = (token, name = "Tester", testId = TID) => call("POST", "/attempt/start", { token, body: { name, testId } });
const open = (token, testId = TID) => call("GET", `/attempt/open?testId=${testId}`, { token });
let db = await getDb();
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
is(await call("GET", "/tests"), 401, "no token -> 401");
is(await call("GET", "/tests", { token: "garbage" }), 401, "garbage token -> 401");
is(await call("GET", "/tests", { token: "a.b.c" }), 401, "three-part token -> 401");
const [body, sig] = A.split(".");
const forgedBody = Buffer.from(JSON.stringify({ role: "admin", sub: "x", exp: 9999999999 })).toString("base64url");
is(await call("GET", "/admin/me", { token: `${forgedBody}.${sig}` }), 401, "payload edited, old signature -> 401");
is(await call("GET", "/tests", { token: `${body}.${"A".repeat(sig.length)}` }), 401, "wrong signature -> 401");
is(await call("GET", "/tests", { token: signToken({ role: "agent", sub: "s" }, -10) }), 401, "expired token -> 401");
is(await call("GET", "/admin/tests", { token: A }), 401, "agent token on an admin route -> 401");
const sessionCheck = await call("GET", "/tests", { token: A });
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
is(await call("GET", "/tests", { token: T }), 401, "admin token on an agent route -> 401");

// lockout (separate email + ip so the rest of the run is unaffected)
await mkAdmin("lock@example.com", "lock-password-1");
let last;
for (let i = 0; i < 8; i++) last = await call("POST", "/admin/login", { body: { email: "lock@example.com", password: `bad${i}` }, ip: "10.9.9.9" });
is(await call("POST", "/admin/login", { body: { email: "lock@example.com", password: "lock-password-1" }, ip: "10.8.8.8" }), 429, "after 8 failures the account is locked even with the right password");
is(await call("POST", "/admin/login", { body: { email: "other@example.com", password: "x" }, ip: "10.9.9.9" }), 429, "after 8 failures the IP is locked for other emails too");
is(await call("POST", "/admin/login", { body: { email: "boss@example.com", password: "correct-horse-1" }, ip: "10.7.7.7" }), 200, "an unrelated admin on another IP is unaffected");
void last;

// ---------------------------------------------------------------------------------
section("a test with no questions");
r = await call("POST", "/admin/tests", { token: T, body: { title: "Disposition Test", passPercent: 70 } });
is(r, 201, "admin creates the main test");
TID = r.data.id;
const E = await newAgent();
r = await start(E); is(r, 409, "starting a test with no questions -> 409");
ok("message is clear", /No questions/.test(r.data.error));
ok("an empty test is not offered to agents", !(await call("GET", "/tests", { token: E })).data.tests.some((t) => t.id === TID));

// ---------------------------------------------------------------------------------
section("admin: questions");
is(await call("GET", `/admin/tests/${TID}`), 401, "a test with its questions needs an admin token");
is(await call("POST", `/admin/tests/${TID}/questions/import`, { token: A, body: { mode: "replace", questions: bank } }), 401, "agent cannot import questions");
r = await call("POST", `/admin/tests/${TID}/questions/import`, { token: T, body: { mode: "replace", questions: [{ question: "x", options: ["only"], answer: "Z" }, { question: "", options: ["a", "b"], answer: "A" }] } });
is(r, 400, "invalid import -> 400"); ok("error lists the problems per question", /Question 1:/.test(r.data.error) && /Question 2:/.test(r.data.error), r.data.error);
is(await call("POST", `/admin/tests/${TID}/questions/import`, { token: T, body: { mode: "wipe", questions: bank } }), 400, "bad import mode -> 400");
is(await call("POST", `/admin/tests/${TID}/questions/import`, { token: T, body: { mode: "replace", questions: [] } }), 400, "empty import -> 400");
ok("a rejected import changed nothing", (await db.collection("questions").countDocuments()) === 0);
r = await call("POST", `/admin/tests/${TID}/questions/import`, { token: T, body: { mode: "replace", questions: bank.map(({ section, question, options, answer }) => ({ section, question, options, answer })) } });
ok("import 30 questions", r.status === 200 && r.data.imported === 30, JSON.stringify(r.data));
r = await call("GET", `/admin/tests/${TID}`, { token: T });
const qs = r.data.questions;
ok("admin sees 30 questions WITH answers, in order", qs.length === 30 && qs.every((q, i) => q.order === i + 1 && letters.includes(q.answer)) && qs[0].answer === "B");
is(await call("POST", `/admin/tests/${TID}/questions`, { token: T, body: { question: "Q?", options: ["a", "b", "c"], answer: "D" } }), 400, "answer outside the options -> 400");
is(await call("POST", `/admin/tests/${TID}/questions`, { token: T, body: { question: "Q?", options: ["a"], answer: "A" } }), 400, "one option -> 400");
is(await call("POST", `/admin/tests/${TID}/questions`, { token: T, body: { question: "Q?", options: ["a", "b", "c", "d", "e", "f", "g"], answer: "A" } }), 400, "seven options -> 400");
is(await call("POST", `/admin/tests/${TID}/questions`, { token: T, body: { question: "Q?", options: ["a", { $gt: "" }], answer: "A" } }), 400, "object as an option -> 400");
r = await call("POST", `/admin/tests/${TID}/questions`, { token: T, body: { section: "Extra", question: "Made by form?", options: ["Yes", "No", "Maybe"], answer: "c" } });
is(r, 201, "create question (lower-case answer normalised)");
const newId = r.data.id;
r = await call("GET", `/admin/tests/${TID}`, { token: T }); const created = r.data.questions.at(-1);
ok("new question is appended with order 31 and answer C", created.id === newId && created.order === 31 && created.answer === "C");
is(await call("PUT", `/admin/questions/${newId}`, { token: T, body: { section: "Extra", question: "Edited?", options: ["Yes", "No", "Maybe"], answer: "A" } }), 200, "update question");
is(await call("PUT", "/admin/questions/000000000000000000000000", { token: T, body: { question: "q", options: ["a", "b"], answer: "A" } }), 404, "update unknown question -> 404");
is(await call("PUT", "/admin/questions/not-an-id", { token: T, body: { question: "q", options: ["a", "b"], answer: "A" } }), 400, "update with malformed id -> 400");
const firstId = qs[0].id;
is(await call("POST", `/admin/tests/${TID}/questions/swap`, { token: T, body: { a: firstId, b: newId } }), 200, "swap order");
r = await call("GET", `/admin/tests/${TID}`, { token: T });
ok("swap exchanged the positions", r.data.questions[0].id === newId && r.data.questions.at(-1).id === firstId);
is(await call("DELETE", `/admin/questions/${newId}`, { token: T }), 200, "delete question");
is(await call("DELETE", `/admin/questions/${newId}`, { token: T }), 404, "delete again -> 404");
r = await call("POST", `/admin/tests/${TID}/questions/import`, { token: T, body: { mode: "append", questions: [{ section: "", question: "Appended?", options: ["Y", "N"], answer: "B" }] } });
ok("append adds after existing", r.status === 200 && (await db.collection("questions").countDocuments()) === 31);
const appended = await db.collection("questions").findOne({ question: "Appended?" });
await call("DELETE", `/admin/questions/${appended._id.toHexString()}`, { token: T });
// restore canonical order (swap earlier moved the original first question to the end)
await call("POST", `/admin/tests/${TID}/questions/import`, { token: T, body: { mode: "replace", questions: bank.map(({ section, question, options, answer }) => ({ section, question, options, answer })) } });
ok("bank restored to 30", (await db.collection("questions").countDocuments()) === 30);

// ---------------------------------------------------------------------------------
section("admin: a test's settings");
r = await call("GET", `/admin/tests/${TID}`, { token: T });
ok("defaults: pass mark 70, open, empty description", r.data.test.passPercent === 70 && r.data.test.active === true && r.data.test.description === "" && r.data.test.title === "Disposition Test");
const put = (body, token = T, id = TID) => call("PUT", `/admin/tests/${id}`, { token, body });
is(await put({ title: "T", passPercent: 0, active: true }), 400, "pass mark 0 -> 400");
is(await put({ title: "T", passPercent: 101, active: true }), 400, "pass mark 101 -> 400");
is(await put({ title: "T", passPercent: 70.5, active: true }), 400, "fractional pass mark -> 400");
is(await put({ title: "T", passPercent: 70, active: "yes" }), 400, "open must be a boolean -> 400");
is(await put({ title: "", passPercent: 70, active: true }), 400, "empty title -> 400");
is(await put({ title: "x".repeat(121), passPercent: 70, active: true }), 400, "title over 120 chars -> 400");
is(await put({ title: { $ne: "" }, passPercent: 70, active: true }), 400, "object as title -> 400");
is(await put({ title: "T", description: "d".repeat(501), passPercent: 70, active: true }), 400, "description over 500 chars -> 400");
is(await put({ title: "T", passPercent: 1, active: true }, A), 401, "agent cannot change settings");
is(await put({ title: "Disposition Test", description: "Call dispositions", passPercent: 70, active: true, $set: { evil: 1 } }), 200, "save settings (extra fields ignored)");
ok("unknown fields were not stored", !("evil" in (await db.collection("tests").findOne({ _id: new ObjectId(TID) }))));
is(await put({ title: "T", passPercent: 70, active: true }, T, "000000000000000000000000"), 404, "unknown test -> 404");
is(await put({ title: "T", passPercent: 70, active: true }, T, "not-an-id"), 400, "malformed test id -> 400");

// ---------------------------------------------------------------------------------
section("agent: question privacy");
r = await call("GET", `/test/${TID}`, { token: A });
ok("agent gets the test's 30 questions", r.data.questions.length === 30);
ok("NO answer anywhere in the agent payload", !/"answer"/i.test(r.text) && r.data.questions.every((q) => !("answer" in q)));
ok("test info shown to agents is limited", JSON.stringify(Object.keys(r.data.test).sort()) === '["active","description","id","passPercent","title"]', JSON.stringify(r.data.test));
r = await call("GET", "/tests", { token: A });
ok("the list shows the test with its question count and no progress yet", r.data.tests.length === 1 && r.data.tests[0].id === TID && r.data.tests[0].questionCount === 30 && r.data.tests[0].openAttemptId === null && r.data.tests[0].last === null, JSON.stringify(r.data));
ok("NO answer anywhere in the list either", !/"answer"/i.test(r.text));

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
is(await call("POST", "/attempt/start", { token: A, body: { name: "Ann" } }), 400, "no test chosen -> 400");
is(await call("POST", "/attempt/start", { token: A, body: { name: "Ann", testId: "nope" } }), 400, "malformed test id -> 400");
is(await call("POST", "/attempt/start", { token: A, body: { name: "Ann", testId: { $ne: "" } } }), 400, "object as test id -> 400");
is(await call("POST", "/attempt/start", { token: A, body: { name: "Ann", testId: "0".repeat(24) } }), 404, "unknown test -> 404");
ok("none of those refused starts created an attempt", (await db.collection("attempts").countDocuments()) === 0);
r = await call("POST", "/attempt/start", { token: A, body: { name: "  Alice   Smith ", testId: TID, employeeId: "E-1", evil: 1 } });
is(r, 200, "start with a name");
const att = r.data.attemptId, ids = r.data.questionIds;
ok("30 question ids frozen, not resumed", ids.length === 30 && r.data.resumed === false);
const attDoc = await db.collection("attempts").findOne({ _id: new ObjectId(att) });
ok("name is trimmed/collapsed; the test is recorded; nothing else from the body is stored; attempt #1", attDoc.name === "Alice Smith" && attDoc.testId === TID && attDoc.testTitle === "Disposition Test" && !("employeeId" in attDoc) && !("evil" in attDoc) && attDoc.attemptNo === 1, JSON.stringify(attDoc));
r = await start(A, "Someone Else");
ok("starting again resumes the same attempt and keeps the original name", r.data.attemptId === att && r.data.resumed === true && (await db.collection("attempts").findOne({ _id: new ObjectId(att) })).name === "Alice Smith");
r = await open(A);
ok("open attempt returns test/name/number/ids/answers, no key", r.data.attempt.id === att && r.data.attempt.testId === TID && r.data.attempt.name === "Alice Smith" && r.data.attempt.attemptNo === 1 && !/"correct"|"answer":"/.test(r.text.replace(/"answers":\{[^}]*\}/, "")));
ok("agent B has no open attempt", (await open(B)).data.attempt === null);

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
r = await open(A);
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
r = await open(A);
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
r = await open(A);
ok("each new test gets the next number", r.data.attempt.attemptNo > 1, JSON.stringify(r.data.attempt));
const b = (await start(B)).data;
ok("another agent can start too", !!b.attemptId);
is(await call("DELETE", `/admin/attempts/${att}`, { token: A }), 401, "agent cannot delete attempts");
is(await call("DELETE", `/admin/attempts/${att}`, { token: T }), 200, "admin deletes the first attempt");
ok("its warnings were deleted too", (await db.collection("violations").countDocuments({ attemptId: stored._id })) === 0);
is(await call("DELETE", `/admin/attempts/${att}`, { token: T }), 404, "delete again -> 404");
await put({ title: "Disposition Test", passPercent: 70, active: false });
const G = await newAgent();
is(await start(G), 403, "closed test -> 403");
r = await call("GET", `/test/${TID}`, { token: G }); ok("agents can see the test is closed", r.data.test.active === false);
ok("a closed test is not offered in the list", !(await call("GET", "/tests", { token: G })).data.tests.some((t) => t.id === TID));
await put({ title: "Disposition Test", passPercent: 70, active: true });
is(await start(G), 200, "re-opened -> starts again");

section("a question deleted mid-test is not scored");
const gAtt = (await open(G)).data.attempt;
await db.collection("questions").deleteOne({ _id: (await db.collection("questions").findOne({}))._id });
const gAns = Object.fromEntries(gAtt.questionIds.map((id, i) => [id, bank[i].answer]));
r = await call("POST", `/attempt/${gAtt.id}/submit`, { token: G, body: { answers: gAns } });
ok("29/29 = 100%", r.data.total === 29 && r.data.score === 29 && r.data.percent === 100, JSON.stringify({ t: r.data.total, s: r.data.score }));

section("pass mark applies at submit time");
await put({ title: "Disposition Test", passPercent: 90, active: true });
const H = await newAgent();
const h = (await start(H)).data;
const hAns = Object.fromEntries(h.questionIds.map((id, i) => [id, i < 25 ? bank[i + 1]?.answer : "A"]).slice(0, 29));
r = await call("POST", `/attempt/${h.attemptId}/submit`, { token: H, body: { answers: Object.fromEntries(h.questionIds.slice(0, 1).map((id) => [id, "A"])) } });
ok("pass mark 90 is used and recorded (low score fails)", r.data.passed === false && r.data.passPercent === 90 && r.data.percent < 90, JSON.stringify(r.data.percent));
void hAns;

// ---------------------------------------------------------------------------------
const mkTest = async (body) => (await call("POST", "/admin/tests", { token: T, body })).data.id;
const qOf = (n) => Array.from({ length: n }, (_, i) => ({ section: "", question: `Q${i + 1}?`, options: ["Yes", "No", "Maybe"], answer: "B" }));
const importQs = (id, qs, mode = "replace") => call("POST", `/admin/tests/${id}/questions/import`, { token: T, body: { mode, questions: qs } });
const sidOf = (token) => JSON.parse(Buffer.from(token.split(".")[0], "base64url")).sub;
const Z0 = "0".repeat(24);

section("multiple tests: the admin manages tests");
is(await call("GET", "/admin/tests"), 401, "the list needs a token");
is(await call("GET", "/admin/tests", { token: A }), 401, "an agent cannot list tests");
is(await call("POST", "/admin/tests", { token: A, body: { title: "x" } }), 401, "an agent cannot create tests");
is(await call("DELETE", `/admin/tests/${TID}`, { token: A }), 401, "an agent cannot delete tests");
is(await call("POST", `/admin/tests/${TID}/duplicate`, { token: A }), 401, "an agent cannot duplicate tests");
for (const bad of [{}, { title: "" }, { title: "   " }, { title: 123 }, { title: { $gt: "" } }, { title: "x".repeat(121) }, { title: "T", passPercent: 0 }, { title: "T", passPercent: "80" }, { title: "T", active: "no" }, { title: "T", description: 5 }])
  is(await call("POST", "/admin/tests", { token: T, body: bad }), 400, `invalid test refused: ${JSON.stringify(bad).slice(0, 60)}`);
ok("none of those created a test", (await db.collection("tests").countDocuments()) === 1);
r = await call("POST", "/admin/tests", { token: T, body: { title: "  Product   Knowledge ", description: "All about our products", passPercent: 80 } });
is(r, 201, "create a second test");
const P = r.data.id;
r = await call("GET", "/admin/tests", { token: T });
let byId = Object.fromEntries(r.data.tests.map((t) => [t.id, t]));
ok("title is trimmed and collapsed; the test is open by default", byId[P].title === "Product Knowledge" && byId[P].passPercent === 80 && byId[P].active === true && byId[P].description === "All about our products");
ok("the list shows question and attempt counts", byId[P].questionCount === 0 && byId[P].attemptCount === 0 && byId[TID].questionCount === 29 && byId[TID].attemptCount > 0, JSON.stringify(byId[TID]));
const defaults = await mkTest({ title: "Defaults only" });
r = await call("GET", `/admin/tests/${defaults}`, { token: T });
ok("a test given only a title gets pass mark 70, open, no description", r.data.test.passPercent === 70 && r.data.test.active === true && r.data.test.description === "");

section("multiple tests: each test has its own questions");
r = await importQs(P, qOf(5));
ok("import 5 questions into test 2", r.status === 200 && r.data.imported === 5);
ok("the main test's questions are untouched (still 29)", (await db.collection("questions").countDocuments({ testId: TID })) === 29);
r = await call("GET", `/admin/tests/${P}`, { token: T });
ok("test 2 has exactly its own 5, numbered from 1, with answers", r.data.questions.length === 5 && r.data.questions.every((q, i) => q.order === i + 1 && q.answer === "B"));
r = await call("POST", `/admin/tests/${P}/questions`, { token: T, body: { section: "", question: "Extra?", options: ["Y", "N"], answer: "A" } });
is(r, 201, "add a question to test 2");
const extraQ = r.data.id;
r = await call("GET", `/admin/tests/${P}`, { token: T });
ok("it is appended after test 2's own questions (order 6)", r.data.questions.at(-1).id === extraQ && r.data.questions.at(-1).order === 6);
const mainFirst = (await call("GET", `/admin/tests/${TID}`, { token: T })).data.questions[0].id;
is(await call("POST", `/admin/tests/${P}/questions/swap`, { token: T, body: { a: extraQ, b: mainFirst } }), 404, "cannot swap with a question of ANOTHER test");
const p2 = (await call("GET", `/admin/tests/${P}`, { token: T })).data.questions;
is(await call("POST", `/admin/tests/${P}/questions/swap`, { token: T, body: { a: p2[0].id, b: p2[1].id } }), 200, "swapping two questions of the same test works");
is(await call("POST", `/admin/tests/${Z0}/questions`, { token: T, body: { question: "q", options: ["a", "b"], answer: "A" } }), 404, "adding a question to an unknown test -> 404");
is(await call("POST", `/admin/tests/${Z0}/questions/import`, { token: T, body: { mode: "replace", questions: qOf(1) } }), 404, "importing into an unknown test -> 404");
is(await call("POST", `/admin/tests/${Z0}/questions/swap`, { token: T, body: { a: p2[0].id, b: p2[1].id } }), 404, "swapping in an unknown test -> 404");
is(await call("GET", `/admin/tests/${Z0}`, { token: T }), 404, "reading an unknown test -> 404");
is(await call("GET", "/admin/tests/not-an-id", { token: T }), 400, "a malformed id -> 400");
r = await importQs(P, qOf(2), "append");
ok("append adds after the existing ones, in that test only", r.status === 200 && (await db.collection("questions").countDocuments({ testId: P })) === 8 && (await db.collection("questions").countDocuments({ testId: TID })) === 29);
await importQs(P, qOf(5), "replace");
ok("replace only replaces THIS test's questions", (await db.collection("questions").countDocuments({ testId: P })) === 5 && (await db.collection("questions").countDocuments({ testId: TID })) === 29);

section("multiple tests: duplicating a test");
r = await call("POST", `/admin/tests/${P}/duplicate`, { token: T });
is(r, 201, "duplicate test 2");
const P2 = r.data.id;
ok("it reports how many questions were copied", r.data.questions === 5);
r = await call("GET", `/admin/tests/${P2}`, { token: T });
ok("the copy is named '(copy)', closed, same pass mark, 5 questions", r.data.test.title === "Product Knowledge (copy)" && r.data.test.active === false && r.data.test.passPercent === 80 && r.data.questions.length === 5);
const orig = (await call("GET", `/admin/tests/${P}`, { token: T })).data.questions;
ok("copied questions have NEW ids but the same text and answers", r.data.questions.every((q, i) => q.id !== orig[i].id && q.question === orig[i].question && q.answer === orig[i].answer));
await call("PUT", `/admin/questions/${r.data.questions[0].id}`, { token: T, body: { section: "", question: "Changed in the copy?", options: ["a", "b"], answer: "A" } });
ok("editing the copy does not change the original", (await call("GET", `/admin/tests/${P}`, { token: T })).data.questions[0].question === orig[0].question);
is(await call("POST", `/admin/tests/${Z0}/duplicate`, { token: T }), 404, "duplicating an unknown test -> 404");
const longTitle = await mkTest({ title: "y".repeat(120) });
r = await call("POST", `/admin/tests/${longTitle}/duplicate`, { token: T });
ok("a 120-character title still duplicates (the title stays within 120)", r.status === 201 && (await call("GET", `/admin/tests/${r.data.id}`, { token: T })).data.test.title.length === 120);

section("multiple tests: the 100-test limit");
const have = await db.collection("tests").countDocuments();
await db.collection("tests").insertMany(Array.from({ length: 100 - have }, (_, i) => ({ title: `filler ${i}`, description: "", passPercent: 70, active: false, createdAt: new Date() })));
is(await call("POST", "/admin/tests", { token: T, body: { title: "one too many" } }), 409, "the 101st test is refused");
is(await call("POST", `/admin/tests/${P}/duplicate`, { token: T }), 409, "duplicating is refused at the limit too");
await db.collection("tests").deleteMany({ title: /^filler / });
is(await call("POST", "/admin/tests", { token: T, body: { title: "fits again" } }), 201, "after removing some, creating works again");

section("multiple tests: what agents see");
const K = await newAgent();
r = await call("GET", "/tests", { token: K });
const listed = r.data.tests.map((t) => t.id);
ok("agents see open tests that have questions (the main test and test 2)", listed.length === 2 && listed.includes(TID) && listed.includes(P), JSON.stringify(listed));
ok("…not empty tests and not closed copies", !listed.includes(defaults) && !listed.includes(P2));
ok("each entry has title, description, pass mark and question count", (() => { const t = r.data.tests.find((x) => x.id === P); return t.title === "Product Knowledge" && t.description === "All about our products" && t.passPercent === 80 && t.questionCount === 5; })());
ok("the list is in creation order (main test first)", r.data.tests[0].id === TID);
r = await call("GET", `/test/${P}`, { token: K });
ok("one test's questions only (5), no answers", r.data.questions.length === 5 && !/"answer"/.test(r.text) && r.data.test.id === P);
is(await call("GET", `/test/${Z0}`, { token: K }), 404, "an unknown test -> 404");
is(await call("GET", "/test/not-an-id", { token: K }), 400, "a malformed id -> 400");
is(await call("GET", `/test/${P}`), 401, "it needs a session");
r = await call("GET", `/test/${P2}`, { token: K });
ok("a closed test can still be looked up by its link and shows as closed", r.status === 200 && r.data.test.active === false);

section("multiple tests: attempts in different tests");
const M = await newAgent();
r = await start(M, "Mia", TID);
is(r, 200, "start test 1");
const mainAtt = r.data;
r = await start(M, "Mia", P);
is(r, 200, "the SAME browser can start test 2 while test 1 is unfinished");
const pAtt = r.data;
ok("two different attempts, each with its own questions", mainAtt.attemptId !== pAtt.attemptId && mainAtt.questionIds.length === 29 && pAtt.questionIds.length === 5 && !mainAtt.questionIds.some((id) => pAtt.questionIds.includes(id)));
const mainDoc = await db.collection("attempts").findOne({ _id: new ObjectId(mainAtt.attemptId) });
const pDoc = await db.collection("attempts").findOne({ _id: new ObjectId(pAtt.attemptId) });
ok("attempt numbers are global and increasing", pDoc.attemptNo === mainDoc.attemptNo + 1);
ok("each attempt records its own test and a title snapshot", pDoc.testId === P && pDoc.testTitle === "Product Knowledge" && mainDoc.testId === TID && mainDoc.testTitle === "Disposition Test");
r = await open(M, P);
ok("the open attempt for test 2 is test 2's", r.data.attempt.id === pAtt.attemptId && r.data.attempt.testId === P && r.data.attempt.questionIds.length === 5);
ok("the open attempt for test 1 is test 1's", (await open(M, TID)).data.attempt.id === mainAtt.attemptId);
ok("no open attempt for a test never started", (await open(M, defaults)).data.attempt === null);
is(await call("GET", "/attempt/open", { token: M }), 400, "open attempt needs the test id");
is(await call("GET", "/attempt/open?testId=zzz", { token: M }), 400, "a malformed test id -> 400");
r = await start(M, "Mia", P);
ok("starting test 2 again resumes it instead of duplicating", r.data.resumed === true && r.data.attemptId === pAtt.attemptId);
r = await call("GET", "/tests", { token: M });
ok("the list marks both tests 'in progress' for this browser", r.data.tests.find((t) => t.id === TID).openAttemptId === mainAtt.attemptId && r.data.tests.find((t) => t.id === P).openAttemptId === pAtt.attemptId);
ok("another browser sees no progress", (await call("GET", "/tests", { token: K })).data.tests.every((t) => t.openAttemptId === null));
is(await call("PUT", `/attempt/${pAtt.attemptId}/answer`, { token: M, body: { questionId: mainAtt.questionIds[0], letter: "A" } }), 409, "a question of test 1 cannot be answered in test 2's attempt");
is(await call("PUT", `/attempt/${pAtt.attemptId}/answer`, { token: K, body: { questionId: pAtt.questionIds[0], letter: "A" } }), 409, "another browser cannot answer it either");
is(await call("POST", `/attempt/${pAtt.attemptId}/submit`, { token: K, body: { answers: {} } }), 404, "…or submit it");
is(await start(M, "Mia", Z0), 404, "starting an unknown test -> 404");
is(await start(M, "Mia", defaults), 409, "starting a test with no questions -> 409");
is(await start(M, "Mia", P2), 403, "starting a closed test -> 403");
const N = await newAgent();
const mixed = await Promise.all([start(N, "Ned", TID), start(N, "Ned", P), start(N, "Ned", TID), start(N, "Ned", P), start(N, "Ned", P)]);
ok("parallel starts on two tests give exactly two attempts", mixed.every((x) => x.status === 200) && new Set(mixed.map((x) => x.data.attemptId)).size === 2, JSON.stringify(mixed.map((x) => x.status)));
ok("…and the database agrees", (await db.collection("attempts").countDocuments({ sid: sidOf(N) })) === 2);

section("multiple tests: scoring and pass marks are per test");
r = await call("POST", `/attempt/${pAtt.attemptId}/submit`, { token: M, body: { answers: Object.fromEntries(pAtt.questionIds.map((id, i) => [id, i < 4 ? "B" : "A"])) } });
ok("4 of 5 = 80% passes test 2's pass mark of 80", r.data.score === 4 && r.data.total === 5 && r.data.percent === 80 && r.data.passed === true && r.data.passPercent === 80, JSON.stringify(r.data));
ok("the result's answer key is test 2's only", Object.keys(r.data.correct).length === 5 && pAtt.questionIds.every((id) => r.data.correct[id] === "B"));
ok("test 1's attempt is still open after test 2 was submitted", (await open(M, TID)).data.attempt.id === mainAtt.attemptId);
r = await call("GET", "/tests", { token: M });
const pl = r.data.tests.find((t) => t.id === P);
ok("the list shows test 2 completed with its last result and no open attempt", pl.openAttemptId === null && pl.last.score === 4 && pl.last.percent === 80 && pl.last.passed === true);
const X = await mkTest({ title: "Easy", passPercent: 70 });
const Y = await mkTest({ title: "Strict", passPercent: 80 });
await importQs(X, qOf(4));
await importQs(Y, qOf(4));
const Zed = await newAgent();
const results = {};
for (const tid of [X, Y]) {
  const st = (await start(Zed, "Zed", tid)).data;
  const ans = Object.fromEntries(st.questionIds.map((id, i) => [id, i < 3 ? "B" : "A"]));
  results[tid] = (await call("POST", `/attempt/${st.attemptId}/submit`, { token: Zed, body: { answers: ans } })).data;
}
ok("3 of 4 = 75% passes the 70% test", results[X].percent === 75 && results[X].passed === true && results[X].passPercent === 70);
ok("the same 75% FAILS the 80% test", results[Y].percent === 75 && results[Y].passed === false && results[Y].passPercent === 80);

section("multiple tests: closing and re-opening a test");
const W = await newAgent();
const wAtt = (await start(W, "Wes", X)).data;
await call("PUT", `/admin/tests/${X}`, { token: T, body: { title: "Easy", passPercent: 70, active: false } });
is(await start(await newAgent(), "Late", X), 403, "a closed test cannot be started by others");
ok("…but is still listed for the browser that has it in progress, so it can be finished", (await call("GET", "/tests", { token: W })).data.tests.some((t) => t.id === X && t.active === false && t.openAttemptId === wAtt.attemptId));
ok("…and not listed for anyone else", !(await call("GET", "/tests", { token: K })).data.tests.some((t) => t.id === X));
is(await call("POST", `/attempt/${wAtt.attemptId}/submit`, { token: W, body: { answers: {} } }), 200, "the unfinished attempt can still be submitted");
await call("PUT", `/admin/tests/${X}`, { token: T, body: { title: "Easy", passPercent: 70, active: true } });
is(await start(await newAgent(), "Again", X), 200, "once re-opened it can be started again");

section("multiple tests: the admin's attempts view");
r = await call("GET", "/admin/attempts", { token: T });
ok("all attempts across tests are listed", r.data.attempts.length >= 8 && new Set(r.data.attempts.map((a) => a.testId)).size >= 3);
const onlyP = await call("GET", `/admin/attempts?testId=${P}`, { token: T });
ok("filtering by test returns only that test's attempts", onlyP.data.attempts.length > 0 && onlyP.data.attempts.every((a) => a.testId === P));
ok("each attempt carries its name and test title", onlyP.data.attempts.every((a) => a.testTitle === "Product Knowledge" && a.name));
ok("answerKeys covers that test's questions only", Object.keys(onlyP.data.answerKeys).length === 5 && Object.values(onlyP.data.answerKeys).every((l) => l === "B"));
is(await call("GET", "/admin/attempts?testId=zzz", { token: T }), 400, "a malformed filter -> 400");
ok("a test with no attempts gives an empty list", (await call("GET", `/admin/attempts?testId=${defaults}`, { token: T })).data.attempts.length === 0);
is(await call("GET", `/admin/attempts?testId=${P}`, { token: A }), 401, "agents cannot use it");

section("multiple tests: renaming and deleting");
await call("PUT", `/admin/tests/${P}`, { token: T, body: { title: "Product Knowledge v2", passPercent: 80, active: true } });
ok("renaming does not rewrite the title recorded on old attempts", (await call("GET", `/admin/attempts?testId=${P}`, { token: T })).data.attempts.every((a) => a.testTitle === "Product Knowledge"));
ok("agents see the new title", (await call("GET", "/tests", { token: K })).data.tests.find((t) => t.id === P).title === "Product Knowledge v2");
const nP = mixed.find((x) => x.data.questionIds.length === 5).data.attemptId;
is(await call("POST", `/attempt/${nP}/violation`, { token: N, body: { type: "tab-switch" } }), 200, "a warning is logged in test 2");
const beforeMainQ = await db.collection("questions").countDocuments({ testId: TID });
const beforeMainA = await db.collection("attempts").countDocuments({ testId: TID });
is(await call("DELETE", `/admin/tests/${P}`, { token: A }), 401, "an agent cannot delete a test");
r = await call("DELETE", `/admin/tests/${P}`, { token: T });
ok("deleting a test reports how many attempts went with it", r.status === 200 && r.data.deletedAttempts === 2, JSON.stringify(r.data));
ok("its questions, attempts and warnings are gone", (await db.collection("tests").countDocuments({ _id: new ObjectId(P) })) === 0 && (await db.collection("questions").countDocuments({ testId: P })) === 0 && (await db.collection("attempts").countDocuments({ testId: P })) === 0 && (await db.collection("violations").countDocuments({ attemptId: new ObjectId(nP) })) === 0);
ok("other tests are untouched", (await db.collection("questions").countDocuments({ testId: TID })) === beforeMainQ && (await db.collection("attempts").countDocuments({ testId: TID })) === beforeMainA);
is(await call("GET", `/test/${P}`, { token: K }), 404, "the deleted test can no longer be opened");
is(await start(K, "Kay", P), 404, "…or started");
ok("a browser's open attempt in it is gone", (await open(N, P)).data.attempt === null);
is(await call("POST", `/attempt/${nP}/submit`, { token: N, body: { answers: {} } }), 404, "…and cannot be submitted");
ok("it disappears from the agents' list", !(await call("GET", "/tests", { token: K })).data.tests.some((t) => t.id === P));
is(await call("DELETE", `/admin/tests/${P}`, { token: T }), 404, "deleting it again -> 404");
is(await call("DELETE", "/admin/tests/not-an-id", { token: T }), 400, "a malformed id -> 400");

section("migration of data saved before multiple tests existed");
await db.collection("questions").insertMany([1, 2, 3].map((n) => ({ section: "Old", question: `Legacy Q${n}?`, options: ["a", "b"], answer: "A", order: n })));
await db.collection("config").updateOne({ _id: "test" }, { $set: { title: "Legacy Exam", passPercent: 65, active: false } }, { upsert: true });
const legacySid = "legacy-session-0001";
const legacyQIds = (await db.collection("questions").find({ testId: { $exists: false } }).sort({ order: 1 }).toArray()).map((q) => q._id.toHexString());
await db.collection("attempts").insertMany([
  { sid: "someone-else", name: "Old Done", attemptNo: 900, status: "completed", startedAt: new Date(), questionIds: legacyQIds, total: 3, answers: {}, score: 2, percent: 67, passed: true, passPercent: 65, correct: {} },
  { sid: legacySid, name: "Old Running", attemptNo: 901, status: "in-progress", startedAt: new Date(), questionIds: legacyQIds, total: 3, answers: {} },
]);
await migrateToMultipleTests(db);
const legacyTest = await db.collection("tests").findOne({ _id: new ObjectId(LEGACY_TEST_ID) });
ok("ONE test is created from the old settings (title, pass mark, closed)", legacyTest && legacyTest.title === "Legacy Exam" && legacyTest.passPercent === 65 && legacyTest.active === false);
ok("the old questions now belong to it", (await db.collection("questions").countDocuments({ testId: LEGACY_TEST_ID })) === 3 && (await db.collection("questions").countDocuments({ testId: { $exists: false } })) === 0);
ok("the old attempts belong to it, with its title", (await db.collection("attempts").countDocuments({ testId: LEGACY_TEST_ID, testTitle: "Legacy Exam" })) === 2);
const testsBefore = await db.collection("tests").countDocuments();
await Promise.all([migrateToMultipleTests(db), migrateToMultipleTests(db), migrateToMultipleTests(db)]);
ok("running it again, even 3 at once, creates no second test and changes nothing", (await db.collection("tests").countDocuments()) === testsBefore && (await db.collection("questions").countDocuments({ testId: LEGACY_TEST_ID })) === 3);
r = await call("GET", "/admin/tests", { token: T });
const lt = r.data.tests.find((t) => t.id === LEGACY_TEST_ID);
ok("the admin sees it with its question and attempt counts", lt && lt.questionCount === 3 && lt.attemptCount === 2, JSON.stringify(lt));
const L = signToken({ role: "agent", sub: legacySid }, 3600);
r = await open(L, LEGACY_TEST_ID);
ok("a browser that was in the middle of an old attempt can resume it", r.data.attempt && r.data.attempt.name === "Old Running" && r.data.attempt.questionIds.length === 3);
r = await call("POST", `/attempt/${r.data.attempt.id}/submit`, { token: L, body: { answers: Object.fromEntries(legacyQIds.map((id) => [id, "A"])) } });
ok("…and finish it, scored with the migrated test's pass mark of 65", r.data.score === 3 && r.data.passed === true && r.data.passPercent === 65);

section("indexes: one running attempt per browser PER TEST");
await db.collection("attempts").deleteMany({});
await db.collection("attempts").createIndex({ sid: 1 }, { unique: true, partialFilterExpression: { status: "in-progress" } }); // the OLD rule
await closeDb();
db = await getDb(); // a server start re-runs the index setup
const indexNames = (await db.collection("attempts").indexes()).map((i) => i.name);
ok("the old one-per-browser index is dropped when the server starts", !indexNames.includes("sid_1"), indexNames.join(","));
ok("the one-per-browser-per-test index exists", indexNames.includes("sid_1_testId_1"));

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
r = await call("GET", "/tests", { token: A, headers: { origin: "https://evil.example" } });
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
