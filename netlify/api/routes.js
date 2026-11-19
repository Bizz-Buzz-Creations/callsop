// The whole MCQ-test API. `handle(request)` takes a standard Request and
// returns a standard Response, so it runs unchanged in a Netlify Function, in
// the local dev server, or inside Express.
//
// Security rules (these replace what Firestore security rules used to do):
//  - The answer key never leaves the server until an attempt is submitted.
//  - Agents hold a signed session token; every attempt belongs to one session.
//  - Attempts are created, scored and completed here, never by the browser.
//  - Admin routes need an admin token and re-check that the admin still exists.
import { ObjectId } from "mongodb";
import { getDb } from "./db.js";
import { DEFAULT_RULES, alwaysAllowedEntries, alwaysAllowedRules } from "./access.js";
import { ConfigError, HttpError, json, readJson } from "./http.js";
import { addressToString, isTooBroad, matchesAny, parseAddress, parseRule, ruleToString } from "./ip.js";
import {
  burnPasswordCheck,
  newSessionId,
  safeEqual,
  signToken,
  verifyPassword,
  verifyToken,
} from "./security.js";
import * as v from "./validate.js";

const AGENT_TOKEN_SECONDS = 30 * 24 * 3600;
const ADMIN_TOKEN_SECONDS = 8 * 3600;
const MAX_LOGIN_FAILURES = 8; // per email and per IP, per 15 minutes
const MAX_VIOLATIONS_PER_ATTEMPT = 500;
const MAX_IMPORT_QUESTIONS = 500;

const MAX_TESTS = 100;
const DEFAULT_PASS_PERCENT = 70;

// A test as agents (and the list) see it.
const publicTest = (t) => ({
  id: t._id.toHexString(),
  title: t.title,
  description: t.description || "",
  passPercent: t.passPercent ?? DEFAULT_PASS_PERCENT,
  active: t.active !== false,
});

// Loads a test by its hex id, or throws a 404.
const findTest = async (db, hexId) => {
  const test = await db.collection("tests").findOne({ _id: v.objectId(hexId, "test") });
  if (!test) throw new HttpError(404, "That test does not exist.");
  return test;
};

// Questions and attempts store their test as a hex string in `testId`.
const countByTest = async (db, collection) =>
  Object.fromEntries(
    (await db.collection(collection).aggregate([{ $group: { _id: "$testId", n: { $sum: 1 } } }]).toArray()).map((row) => [row._id, row.n])
  );

const publicQuestion = (q) => ({
  id: q._id.toHexString(),
  order: q.order,
  section: q.section || "",
  question: q.question,
  options: q.options,
});

const adminQuestion = (q) => ({ ...publicQuestion(q), answer: q.answer });

const attemptSummary = (a) => ({
  score: a.score,
  total: a.total,
  percent: a.percent,
  passed: a.passed,
  passPercent: a.passPercent,
  correct: a.correct,
  answers: a.answers || {}, // the answers that were actually scored
});

// Does at least one question of an attempt still exist? "Replace all" in the admin panel
// gives every question a new id, so an attempt that started before it can never be
// scored. Such an attempt is discarded instead of being recorded as a failed 0 / 0.
const hasLiveQuestions = async (db, questionIds) =>
  questionIds.length > 0 &&
  (await db.collection("questions").countDocuments({ _id: { $in: questionIds.map((id) => new ObjectId(id)) } }, { limit: 1 })) > 0;

const voidAttempt = async (db, attemptId) => {
  await db.collection("violations").deleteMany({ attemptId });
  await db.collection("attempts").deleteOne({ _id: attemptId });
};

// This session's running attempt in one test (a dead one is discarded, see above).
const findOpenAttempt = async (db, sid, testId) => {
  const open = await db.collection("attempts").findOne({ sid, status: "in-progress", testId });
  if (open && !(await hasLiveQuestions(db, open.questionIds || []))) {
    await voidAttempt(db, open._id);
    return null;
  }
  return open;
};

// ---- Agent routes ---------------------------------------------------------------

const routes = [];
const route = (method, pattern, role, handler, maxBody = 100_000) =>
  routes.push({ method, pattern, re: new RegExp(`^${pattern}$`), role, handler, maxBody });

route("GET", "/health", null, async () =>
  json(200, {
    ok: true,
    configured: {
      mongo: Boolean(process.env.MONGODB_URI),
      secret: (process.env.SESSION_SECRET || "").length >= 32,
    },
  })
);

// Gives a browser an anonymous session. There is no personal data in it.
route("POST", "/session", null, async () =>
  json(200, { token: signToken({ role: "agent", sub: newSessionId() }, AGENT_TOKEN_SECONDS) })
);

// The tests an agent can take, with this browser's own progress on each.
route("GET", "/tests", "agent", async ({ db, auth }) => {
  const [tests, questionCounts, mine] = await Promise.all([
    db.collection("tests").find({}).sort({ createdAt: 1 }).toArray(),
    countByTest(db, "questions"),
    db
      .collection("attempts")
      .find({ sid: auth.sub }, { projection: { testId: 1, status: 1, score: 1, total: 1, percent: 1, passed: 1 } })
      .sort({ startedAt: -1 })
      .limit(300)
      .toArray(),
  ]);
  // Running attempts whose questions were all replaced are not "in progress" any more.
  const running = await db
    .collection("attempts")
    .find({ sid: auth.sub, status: "in-progress" }, { projection: { testId: 1, questionIds: 1 } })
    .toArray();
  const stillExist = new Set(
    (
      await db
        .collection("questions")
        .find({ _id: { $in: running.flatMap((a) => (a.questionIds || []).map((id) => new ObjectId(id))) } }, { projection: { _id: 1 } })
        .toArray()
    ).map((q) => q._id.toHexString())
  );
  const open = {};
  const last = {};
  for (const a of running) {
    if ((a.questionIds || []).some((id) => stillExist.has(id))) open[a.testId] ||= a._id.toHexString();
  }
  for (const a of mine) {
    if (a.status !== "in-progress" && !last[a.testId]) last[a.testId] = { score: a.score, total: a.total, percent: a.percent, passed: a.passed };
  }
  return json(200, {
    tests: tests
      .map((t) => ({
        ...publicTest(t),
        questionCount: questionCounts[t._id.toHexString()] || 0,
        openAttemptId: open[t._id.toHexString()] || null,
        last: last[t._id.toHexString()] || null,
      }))
      // Open tests that have questions, plus any test this browser still has to finish.
      .filter((t) => (t.active && t.questionCount > 0) || t.openAttemptId),
  });
});

// One test and its questions WITHOUT answers.
route("GET", "/test/([^/]+)", "agent", async ({ db, params }) => {
  const test = await findTest(db, params[0]);
  const questions = await db
    .collection("questions")
    .find({ testId: test._id.toHexString() }, { projection: { answer: 0 } })
    .sort({ order: 1 })
    .toArray();
  return json(200, { test: publicTest(test), questions: questions.map(publicQuestion) });
});

// This browser's unfinished attempt in one test, if any.
route("GET", "/attempt/open", "agent", async ({ db, auth, req }) => {
  const testId = v.hexId(new URL(req.url).searchParams.get("testId"), "test");
  const open = await findOpenAttempt(db, auth.sub, testId);
  return json(200, {
    attempt: open && {
      id: open._id.toHexString(),
      testId: open.testId,
      name: open.name,
      attemptNo: open.attemptNo,
      questionIds: open.questionIds,
      answers: open.answers || {},
    },
  });
});

// Starts (or resumes) an attempt at one test. Agents give only their name (required,
// so the admin knows who took it). A browser has at most one running attempt per test.
route("POST", "/attempt/start", "agent", async ({ db, auth, body }) => {
  const input = v.object(await body());
  const name = v.text(input.name, "Name", { max: 80 });
  const test = await findTest(db, v.hexId(input.testId, "test"));
  const testId = test._id.toHexString();
  const attempts = db.collection("attempts");
  if (test.active === false) throw new HttpError(403, "This test is not open right now.");

  const resume = (open) =>
    json(200, {
      attemptId: open._id.toHexString(),
      resumed: true,
      questionIds: open.questionIds,
      answers: open.answers || {},
    });

  const open = await findOpenAttempt(db, auth.sub, testId);
  if (open) return resume(open);

  const questions = await db
    .collection("questions")
    .find({ testId }, { projection: { _id: 1 } })
    .sort({ order: 1 })
    .toArray();
  if (!questions.length) throw new HttpError(409, "No questions have been added to this test yet.");
  const questionIds = questions.map((q) => q._id.toHexString()); // frozen at start

  // Sequential number the admin sees ("Attempt #12"), across all tests.
  const counter = await db
    .collection("counters")
    .findOneAndUpdate({ _id: "attempts" }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });

  try {
    const { insertedId } = await attempts.insertOne({
      sid: auth.sub,
      testId,
      testTitle: test.title,
      name,
      attemptNo: counter.seq,
      status: "in-progress",
      startedAt: new Date(),
      questionIds,
      total: questionIds.length,
      answers: {},
    });
    return json(200, { attemptId: insertedId.toHexString(), resumed: false, questionIds, answers: {} });
  } catch (err) {
    if (err?.code === 11000) {
      // Two starts raced; the unique index kept only one. Resume that one.
      const winner = await attempts.findOne({ sid: auth.sub, status: "in-progress", testId });
      if (winner) return resume(winner);
    }
    throw err;
  }
});

route("PUT", "/attempt/([^/]+)/answer", "agent", async ({ db, auth, params, body }) => {
  const attemptId = v.objectId(params[0], "attempt");
  const input = v.object(await body());
  const questionId = v.hexId(input.questionId, "question");
  const answer = v.letter(input.letter);
  // One atomic update: it must be this session's, still in progress, and the
  // question must belong to this attempt.
  const res = await db.collection("attempts").updateOne(
    { _id: attemptId, sid: auth.sub, status: "in-progress", questionIds: questionId },
    { $set: { [`answers.${questionId}`]: answer } }
  );
  if (!res.matchedCount) {
    throw new HttpError(409, "That answer could not be saved (the test is finished or not yours).");
  }
  return json(200, { ok: true });
});

route("POST", "/attempt/([^/]+)/violation", "agent", async ({ db, auth, params, body }) => {
  const attemptId = v.objectId(params[0], "attempt");
  const input = v.object(await body());
  if (!v.VIOLATION_TYPES.includes(input.type)) throw new HttpError(400, "Unknown warning type.");

  const attempt = await db
    .collection("attempts")
    .findOne({ _id: attemptId, sid: auth.sub, status: "in-progress" }, { projection: { _id: 1 } });
  if (!attempt) throw new HttpError(409, "No running test to report against.");

  const violations = db.collection("violations");
  if ((await violations.countDocuments({ attemptId })) < MAX_VIOLATIONS_PER_ATTEMPT) {
    await violations.insertOne({ attemptId, type: input.type, at: new Date() });
  }
  return json(200, { ok: true });
});

// Scores on the server with the private answer key.
route("POST", "/attempt/([^/]+)/submit", "agent", async ({ db, auth, params, body }) => {
  const attemptId = v.objectId(params[0], "attempt");
  const input = v.object(await body());
  const sent = v.object(input.answers ?? {}, "Answers");
  const attempts = db.collection("attempts");

  const attempt = await attempts.findOne({ _id: attemptId, sid: auth.sub });
  if (!attempt) throw new HttpError(404, "Attempt not found.");
  // Submitting twice returns the stored result instead of rescoring.
  if (attempt.status === "completed") return json(200, attemptSummary(attempt));

  // Only questions that still exist (and have a key) can be scored.
  const keyed = await db
    .collection("questions")
    .find({ _id: { $in: attempt.questionIds.map((id) => new ObjectId(id)) } }, { projection: { answer: 1 } })
    .toArray();
  const correct = {};
  keyed.forEach((q) => (correct[q._id.toHexString()] = q.answer));
  const scoredIds = Object.keys(correct);
  if (!scoredIds.length) {
    // Every question of this attempt was removed or replaced while it was running.
    await voidAttempt(db, attemptId);
    throw new HttpError(409, "This test was changed while you were taking it, so it could not be scored. Please start it again.");
  }

  // The answers this browser sends, plus any already saved from another tab of the same
  // attempt (what is sent wins), so a stale tab cannot erase answers.
  const merged = { ...(attempt.answers || {}), ...sent };
  const answers = {};
  scoredIds.forEach((id) => {
    if (typeof merged[id] === "string" && v.LETTERS.includes(merged[id])) answers[id] = merged[id];
  });

  // The pass mark of the test as it is NOW (a deleted test falls back to the default).
  const test = ObjectId.isValid(attempt.testId)
    ? await db.collection("tests").findOne({ _id: new ObjectId(attempt.testId) }, { projection: { passPercent: 1 } })
    : null;
  const passPercent = test?.passPercent ?? DEFAULT_PASS_PERCENT;
  const total = scoredIds.length;
  const score = scoredIds.filter((id) => answers[id] === correct[id]).length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  const result = {
    score,
    total,
    percent,
    passed: percent >= passPercent,
    passPercent,
    correct,
    answers,
  };

  const done = await attempts.findOneAndUpdate(
    { _id: attemptId, sid: auth.sub, status: "in-progress" },
    { $set: { ...result, status: "completed", finishedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (done) return json(200, result);
  // Lost a race with another submit of the same attempt: return that result.
  const stored = await attempts.findOne({ _id: attemptId, sid: auth.sub });
  return json(200, attemptSummary(stored));
});

// ---- Admin routes ---------------------------------------------------------------

const clientIp = (req, hint) =>
  hint ||
  req.headers.get("x-nf-client-connection-ip") ||
  req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
  "unknown";

route("POST", "/admin/login", null, async ({ db, body, ip }) => {
  const input = v.object(await body());
  const email = v.text(input.email, "Email", { max: 200 }).toLowerCase();
  const password = v.text(input.password, "Password", { max: 200, collapse: false });

  const failures = db.collection("loginFailures");
  const keys = [`email:${email}`, `ip:${ip}`];
  const since = new Date(Date.now() - 15 * 60 * 1000);
  // Count each key separately: locked if EITHER this email OR this IP has too many.
  const counts = await Promise.all(keys.map((key) => failures.countDocuments({ key, at: { $gte: since } })));
  if (counts.some((count) => count >= MAX_LOGIN_FAILURES)) {
    throw new HttpError(429, "Too many failed attempts. Wait 15 minutes and try again.");
  }

  const admin = await db.collection("admins").findOne({ email });
  const valid = admin ? await verifyPassword(password, admin.passwordHash) : (await burnPasswordCheck(password), false);
  if (!valid) {
    await failures.insertMany(keys.map((key) => ({ key, at: new Date() })));
    throw new HttpError(401, "Incorrect email or password.");
  }
  await failures.deleteMany({ key: `email:${email}` });
  return json(200, {
    token: signToken({ role: "admin", sub: admin._id.toHexString() }, ADMIN_TOKEN_SECONDS),
    email: admin.email,
  });
});

route("GET", "/admin/me", "admin", async ({ auth }) => json(200, { email: auth.email }));

// ---- Admin: tests -----------------------------------------------------------------

// Validates the fields of a test. Used for both creating and editing.
const parseTestInput = (input) => ({
  title: v.text(input.title, "Title", { max: 120 }),
  description: input.description == null || input.description === "" ? "" : v.text(input.description, "Description", { max: 500, collapse: false }),
  passPercent: input.passPercent == null ? DEFAULT_PASS_PERCENT : v.integer(input.passPercent, "Pass mark", { min: 1, max: 100 }),
  active: input.active == null ? true : input.active === true || input.active === false ? input.active : v.fail("Open must be true or false."),
});

route("GET", "/admin/tests", "admin", async ({ db }) => {
  const [tests, questionCounts, attemptCounts] = await Promise.all([
    db.collection("tests").find({}).sort({ createdAt: 1 }).toArray(),
    countByTest(db, "questions"),
    countByTest(db, "attempts"),
  ]);
  return json(200, {
    tests: tests.map((t) => ({
      ...publicTest(t),
      createdAt: t.createdAt,
      questionCount: questionCounts[t._id.toHexString()] || 0,
      attemptCount: attemptCounts[t._id.toHexString()] || 0,
    })),
  });
});

route("POST", "/admin/tests", "admin", async ({ db, body }) => {
  const test = parseTestInput(v.object(await body()));
  if ((await db.collection("tests").countDocuments({})) >= MAX_TESTS) throw new HttpError(409, `Too many tests (max ${MAX_TESTS}).`);
  const { insertedId } = await db.collection("tests").insertOne({ ...test, createdAt: new Date() });
  return json(201, { id: insertedId.toHexString() });
});

// One test with all its questions AND answers (for the editor).
route("GET", "/admin/tests/([^/]+)", "admin", async ({ db, params }) => {
  const test = await findTest(db, params[0]);
  const questions = await db.collection("questions").find({ testId: test._id.toHexString() }).sort({ order: 1 }).toArray();
  return json(200, { test: publicTest(test), questions: questions.map(adminQuestion) });
});

route("PUT", "/admin/tests/([^/]+)", "admin", async ({ db, params, body }) => {
  const test = await findTest(db, params[0]);
  const changes = parseTestInput(v.object(await body()));
  await db.collection("tests").updateOne({ _id: test._id }, { $set: changes });
  return json(200, { ok: true });
});

// Deleting a test removes everything that belongs to it: its questions, attempts
// and warnings. The admin panel asks for confirmation first.
route("DELETE", "/admin/tests/([^/]+)", "admin", async ({ db, params }) => {
  const test = await findTest(db, params[0]);
  const testId = test._id.toHexString();
  const attempts = await db.collection("attempts").find({ testId }, { projection: { _id: 1 } }).toArray();
  if (attempts.length) await db.collection("violations").deleteMany({ attemptId: { $in: attempts.map((a) => a._id) } });
  await db.collection("attempts").deleteMany({ testId });
  await db.collection("questions").deleteMany({ testId });
  await db.collection("tests").deleteOne({ _id: test._id });
  return json(200, { deletedAttempts: attempts.length });
});

// "<title> (copy)", shortening a very long title so the marker is never cut off.
const copyTitle = (title) => {
  const suffix = " (copy)";
  return title.length + suffix.length <= 120 ? title + suffix : title.slice(0, 120 - suffix.length).trimEnd() + suffix;
};

// A copy with all questions, closed so the admin can review it before opening it.
route("POST", "/admin/tests/([^/]+)/duplicate", "admin", async ({ db, params }) => {
  const source = await findTest(db, params[0]);
  if ((await db.collection("tests").countDocuments({})) >= MAX_TESTS) throw new HttpError(409, `Too many tests (max ${MAX_TESTS}).`);
  const { insertedId } = await db.collection("tests").insertOne({
    title: copyTitle(source.title),
    description: source.description || "",
    passPercent: source.passPercent ?? DEFAULT_PASS_PERCENT,
    active: false,
    createdAt: new Date(),
  });
  const questions = await db.collection("questions").find({ testId: source._id.toHexString() }).sort({ order: 1 }).toArray();
  if (questions.length) {
    await db.collection("questions").insertMany(
      questions.map((q) => {
        const copy = { ...q, testId: insertedId.toHexString() };
        delete copy._id; // each copy gets its own new id
        return copy;
      })
    );
  }
  return json(201, { id: insertedId.toHexString(), questions: questions.length });
});

// ---- Admin: questions of a test -----------------------------------------------------

const nextOrder = async (db, testId) => {
  const last = await db.collection("questions").find({ testId }, { projection: { order: 1 } }).sort({ order: -1 }).limit(1).toArray();
  return (last[0]?.order || 0) + 1;
};

route("POST", "/admin/tests/([^/]+)/questions", "admin", async ({ db, params, body }) => {
  const test = await findTest(db, params[0]);
  const testId = test._id.toHexString();
  const q = v.question(await body());
  if ((await db.collection("questions").countDocuments({ testId })) >= MAX_IMPORT_QUESTIONS) {
    throw new HttpError(409, `This test is full (max ${MAX_IMPORT_QUESTIONS} questions).`);
  }
  const { insertedId } = await db.collection("questions").insertOne({ ...q, testId, order: await nextOrder(db, testId) });
  return json(201, { id: insertedId.toHexString() });
});

route("POST", "/admin/tests/([^/]+)/questions/swap", "admin", async ({ db, params, body }) => {
  const test = await findTest(db, params[0]);
  const input = v.object(await body());
  const a = v.objectId(input.a, "first question");
  const b = v.objectId(input.b, "second question");
  // Both must belong to THIS test.
  const docs = await db
    .collection("questions")
    .find({ _id: { $in: [a, b] }, testId: test._id.toHexString() }, { projection: { order: 1 } })
    .toArray();
  if (docs.length !== 2) throw new HttpError(404, "Question not found in this test.");
  const [first, second] = docs;
  await db.collection("questions").bulkWrite([
    { updateOne: { filter: { _id: first._id }, update: { $set: { order: second.order } } } },
    { updateOne: { filter: { _id: second._id }, update: { $set: { order: first.order } } } },
  ]);
  return json(200, { ok: true });
});

route("POST", "/admin/tests/([^/]+)/questions/import", "admin", async ({ db, params, body }) => {
  const test = await findTest(db, params[0]);
  const testId = test._id.toHexString();
  const input = v.object(await body(1_000_000));
  if (!["replace", "append"].includes(input.mode)) throw new HttpError(400, "Mode must be replace or append.");
  if (!Array.isArray(input.questions) || !input.questions.length) {
    throw new HttpError(400, "No questions to import.");
  }
  if (input.questions.length > MAX_IMPORT_QUESTIONS) {
    throw new HttpError(400, `Too many questions (max ${MAX_IMPORT_QUESTIONS}).`);
  }
  // Validate everything first so a bad file imports nothing.
  const problems = [];
  const cleaned = input.questions.map((q, i) => {
    try {
      return v.question(q, `Question ${i + 1}`);
    } catch (err) {
      problems.push(err.message);
      return null;
    }
  });
  if (problems.length) throw new HttpError(400, problems.slice(0, 8).join("\n"));

  const questions = db.collection("questions");
  let start = 1;
  if (input.mode === "replace") await questions.deleteMany({ testId });
  else {
    // The limit is on how many questions there ARE; `order` can have gaps after deletions.
    if ((await questions.countDocuments({ testId })) + cleaned.length > MAX_IMPORT_QUESTIONS) {
      throw new HttpError(409, `That would exceed ${MAX_IMPORT_QUESTIONS} questions in this test.`);
    }
    start = await nextOrder(db, testId);
  }
  await questions.insertMany(cleaned.map((q, i) => ({ ...q, testId, order: start + i })));
  return json(200, { imported: cleaned.length });
});

route("PUT", "/admin/questions/([^/]+)", "admin", async ({ db, params, body }) => {
  const id = v.objectId(params[0], "question");
  const q = v.question(await body());
  const res = await db.collection("questions").updateOne({ _id: id }, { $set: q });
  if (!res.matchedCount) throw new HttpError(404, "Question not found.");
  return json(200, { ok: true });
});

route("DELETE", "/admin/questions/([^/]+)", "admin", async ({ db, params }) => {
  const res = await db.collection("questions").deleteOne({ _id: v.objectId(params[0], "question") });
  if (!res.deletedCount) throw new HttpError(404, "Question not found.");
  return json(200, { ok: true });
});

// ---- Admin: attempts ------------------------------------------------------------------

// Every attempt with its warnings, optionally for one test (?testId=). The admin
// panel polls this for live updates. `answerKeys` maps question id -> correct letter
// for the questions that still exist, so the panel can colour each answer.
route("GET", "/admin/attempts", "admin", async ({ db, req }) => {
  const filter = new URL(req.url).searchParams.get("testId");
  const rows = await db
    .collection("attempts")
    .aggregate([
      { $match: filter ? { testId: v.hexId(filter, "test") } : {} },
      { $sort: { startedAt: -1 } },
      { $limit: 500 },
      { $lookup: { from: "violations", localField: "_id", foreignField: "attemptId", as: "violations" } },
      { $project: { sid: 0 } },
    ])
    .toArray();
  const testIds = [...new Set(rows.map((a) => a.testId).filter(Boolean))];
  const keyed = testIds.length
    ? await db.collection("questions").find({ testId: { $in: testIds } }, { projection: { answer: 1 } }).toArray()
    : [];
  return json(200, {
    answerKeys: Object.fromEntries(keyed.map((q) => [q._id.toHexString(), q.answer])),
    attempts: rows.map(({ _id, violations, ...a }) => ({
      ...a,
      id: _id.toHexString(),
      violations: violations
        .sort((x, y) => x.at - y.at)
        .map((w) => ({ id: w._id.toHexString(), type: w.type, at: w.at })),
    })),
  });
});

route("DELETE", "/admin/attempts/([^/]+)", "admin", async ({ db, params }) => {
  const attemptId = v.objectId(params[0], "attempt");
  await db.collection("violations").deleteMany({ attemptId });
  const res = await db.collection("attempts").deleteOne({ _id: attemptId });
  if (!res.deletedCount) throw new HttpError(404, "Attempt not found.");
  return json(200, { ok: true });
});

// ---- IP access control -----------------------------------------------------------
// The allowlist is edited here (admin panel) and read by the edge function
// (netlify/edge-functions/ip-filter.js) through /edge/access. The built-in IPs
// in access.js are always allowed, so the panel can always be reached.

const MAX_IP_RULES = 500;
const isActiveRule = (rule, now = new Date()) => !rule.expiresAt || rule.expiresAt > now;

// Saves the default rules ONCE (a flag remembers it, so rules an admin deletes stay deleted).
const seedDefaultRules = async (db) => {
  const settings = db.collection("config");
  if ((await settings.findOne({ _id: "access" }, { projection: { defaultsSeeded: 1 } }))?.defaultsSeeded) return;
  const rules = db.collection("ipRules");
  for (const { value, label } of DEFAULT_RULES) {
    const canonical = ruleToString(parseRule(value));
    try {
      await rules.insertOne({ value: canonical, label, createdAt: new Date(), createdBy: "default", expiresAt: null });
    } catch (err) {
      if (err?.code !== 11000) throw err; // already there (or a parallel request just added it)
    }
  }
  await settings.updateOne({ _id: "access" }, { $set: { defaultsSeeded: true } }, { upsert: true });
};

const loadAccess = async (db) => {
  await seedDefaultRules(db);
  const [setting, rules] = await Promise.all([
    db.collection("config").findOne({ _id: "access" }),
    db.collection("ipRules").find({}).sort({ createdAt: 1 }).toArray(),
  ]);
  return { enabled: setting?.enabled === true, rules };
};

const publicRule = (rule, now = new Date()) => ({
  id: rule._id.toHexString(),
  value: rule.value,
  label: rule.label || "",
  createdAt: rule.createdAt,
  createdBy: rule.createdBy || "",
  expiresAt: rule.expiresAt || null,
  expired: !isActiveRule(rule, now),
});

// Would this IP get in, given these admin rules (plus the built-in ones)?
const ipIsAllowed = (ip, rules) => {
  const allowed = [
    ...alwaysAllowedRules(process.env.ALWAYS_ALLOWED_IPS),
    ...rules.filter((r) => isActiveRule(r)).map((r) => parseRule(r.value)).filter(Boolean),
  ];
  return matchesAny(ip, allowed);
};

const displayIp = (ip) => {
  const parsed = parseAddress(ip);
  return parsed ? addressToString(parsed) : String(ip);
};

route("GET", "/admin/access", "admin", async ({ db, ip }) => {
  const { enabled, rules } = await loadAccess(db);
  const secret = process.env.EDGE_SECRET || "";
  return json(200, {
    enabled,
    myIp: displayIp(ip),
    myIpAllowed: ipIsAllowed(ip, rules),
    alwaysAllowed: alwaysAllowedEntries(process.env.ALWAYS_ALLOWED_IPS),
    // The edge function needs EDGE_SECRET; without it the filter cannot run.
    edgeConfigured: secret.length >= 20,
    rules: rules.map((r) => publicRule(r)),
  });
});

route("PUT", "/admin/access", "admin", async ({ db, body, ip }) => {
  const input = v.object(await body());
  if (typeof input.enabled !== "boolean") throw new HttpError(400, "Enabled must be true or false.");
  if (input.enabled) {
    const { rules } = await loadAccess(db);
    if (!ipIsAllowed(ip, rules)) {
      throw new HttpError(
        409,
        `Your current IP (${displayIp(ip)}) is not allowed yet. Add it first, or turning the filter on would lock you out of this panel.`
      );
    }
  }
  await db.collection("config").updateOne({ _id: "access" }, { $set: { enabled: input.enabled } }, { upsert: true });
  return json(200, { enabled: input.enabled });
});

route("POST", "/admin/access/rules", "admin", async ({ db, body, auth }) => {
  const input = v.object(await body());
  const rule = parseRule(v.text(input.value, "IP address", { max: 64 }));
  if (!rule) throw new HttpError(400, "That is not a valid IP address or range (examples: 203.0.113.7 or 203.0.113.0/24).");
  if (isTooBroad(rule)) {
    throw new HttpError(400, "That range is far too wide and would let in a large part of the internet. Use a narrower range.");
  }
  const label = input.label == null || input.label === "" ? "" : v.text(input.label, "Label", { max: 80 });
  let expiresAt = null;
  if (input.hours != null) {
    expiresAt = new Date(Date.now() + v.integer(input.hours, "Hours", { min: 1, max: 24 * 365 }) * 3600 * 1000);
  }

  const rules = db.collection("ipRules");
  const value = ruleToString(rule);
  if (await rules.countDocuments({}) >= MAX_IP_RULES) throw new HttpError(409, `The list is full (max ${MAX_IP_RULES}).`);
  if (await rules.findOne({ value })) throw new HttpError(409, `${value} is already in the list.`);
  const { insertedId } = await rules.insertOne({ value, label, createdAt: new Date(), createdBy: auth.email, expiresAt });
  return json(201, { id: insertedId.toHexString(), value });
});

route("DELETE", "/admin/access/rules/([^/]+)", "admin", async ({ db, params, ip }) => {
  const id = v.objectId(params[0], "rule");
  const { enabled, rules } = await loadAccess(db);
  if (!rules.some((r) => r._id.equals(id))) throw new HttpError(404, "Rule not found.");
  // Do not let an admin delete the rule that is keeping them in.
  if (enabled && !ipIsAllowed(ip, rules.filter((r) => !r._id.equals(id)))) {
    throw new HttpError(409, `Removing this would lock you out (your IP ${displayIp(ip)} is allowed only by it). Turn the filter off first.`);
  }
  await db.collection("ipRules").deleteOne({ _id: id });
  return json(200, { ok: true });
});

// Read by the edge function only, proven by a shared secret header.
route("GET", "/edge/access", null, async ({ req, db }) => {
  const secret = process.env.EDGE_SECRET || "";
  if (secret.length < 20) throw new HttpError(503, "EDGE_SECRET is not set (needs 20+ characters).");
  if (!safeEqual(req.headers.get("x-edge-secret") || "", secret)) throw new HttpError(401, "Not allowed.");
  const { enabled, rules } = await loadAccess(db);
  return json(200, { enabled, rules: rules.filter((r) => isActiveRule(r)).map((r) => r.value) });
});

// ---- Dispatcher -----------------------------------------------------------------

const authenticate = async (req, role, db) => {
  const header = req.headers.get("authorization") || "";
  const claims = verifyToken(header.startsWith("Bearer ") ? header.slice(7) : "");
  if (!claims || claims.role !== role || typeof claims.sub !== "string") {
    throw new HttpError(401, "Please sign in again.");
  }
  if (role === "admin") {
    // A deleted admin's token stops working immediately.
    const admin = /^[a-f0-9]{24}$/.test(claims.sub)
      ? await db.collection("admins").findOne({ _id: new ObjectId(claims.sub) }, { projection: { email: 1 } })
      : null;
    if (!admin) throw new HttpError(401, "Please sign in again.");
    return { ...claims, email: admin.email };
  }
  return claims;
};

// Same-origin by default. Set ALLOWED_ORIGIN (comma-separated) only if the
// website is served from a different domain than this API.
const corsHeaders = (req) => {
  const allowed = (process.env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin");
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
};

export const handle = async (req, { ip } = {}) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  let response;
  try {
    const { pathname } = new URL(req.url);
    const match = pathname.match(/^(?:\/\.netlify\/functions\/api|\/api)(\/.*)?$/);
    const path = (match?.[1] || "/").replace(/\/+$/, "") || "/";

    let found;
    let params = [];
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = path.match(r.re);
      if (m) {
        found = r;
        params = m.slice(1);
        break;
      }
    }
    if (!found) throw new HttpError(404, "Not found.");

    // /health must answer even when the database is not configured yet.
    const db = found.pattern === "/health" ? null : await getDb();
    const auth = found.role ? await authenticate(req, found.role, db) : null;
    response = await found.handler({
      req,
      db,
      auth,
      params,
      ip: clientIp(req, ip),
      body: (max = found.maxBody) => readJson(req, max),
    });
  } catch (err) {
    if (err instanceof HttpError) {
      response = json(err.status, { error: err.message });
    } else if (err instanceof ConfigError) {
      console.error("API configuration error:", err.message);
      response = json(500, { error: `The server is not configured: ${err.message}` });
    } else {
      console.error("API error:", err);
      response = json(500, { error: "Server error. Please try again." });
    }
  }
  Object.entries(cors).forEach(([k, val]) => response.headers.set(k, val));
  return response;
};
