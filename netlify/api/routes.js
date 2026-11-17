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
import { ConfigError, HttpError, json, readJson } from "./http.js";
import {
  burnPasswordCheck,
  newSessionId,
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

const DEFAULT_CONFIG = {
  title: "Call Disposition Assessment",
  passPercent: 70,
  active: true,
};

const loadConfig = async (db) => {
  const stored = await db.collection("config").findOne({ _id: "test" });
  const { _id, ...rest } = stored || {};
  return { ...DEFAULT_CONFIG, ...rest };
};

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
});

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

// Settings + questions WITHOUT answers.
route("GET", "/test", "agent", async ({ db }) => {
  const [config, questions] = await Promise.all([
    loadConfig(db),
    db.collection("questions").find({}, { projection: { answer: 0 } }).sort({ order: 1 }).toArray(),
  ]);
  return json(200, {
    config: { title: config.title, passPercent: config.passPercent, active: config.active },
    questions: questions.map(publicQuestion),
  });
});

route("GET", "/attempt/open", "agent", async ({ db, auth }) => {
  const open = await db.collection("attempts").findOne({ sid: auth.sub, status: "in-progress" });
  return json(200, {
    attempt: open && {
      id: open._id.toHexString(),
      name: open.name,
      attemptNo: open.attemptNo,
      questionIds: open.questionIds,
      answers: open.answers || {},
    },
  });
});

// Starts (or resumes) a test. Agents give only their name (required, so the admin
// knows who took it). Each browser session has at most one running test.
route("POST", "/attempt/start", "agent", async ({ db, auth, body }) => {
  const input = v.object(await body());
  const name = v.text(input.name, "Name", { max: 80 });
  const attempts = db.collection("attempts");
  const config = await loadConfig(db);
  if (!config.active) throw new HttpError(403, "This test is not open right now.");

  const resume = (open) =>
    json(200, {
      attemptId: open._id.toHexString(),
      resumed: true,
      questionIds: open.questionIds,
      answers: open.answers || {},
    });

  const open = await attempts.findOne({ sid: auth.sub, status: "in-progress" });
  if (open) return resume(open);

  const questions = await db
    .collection("questions")
    .find({}, { projection: { _id: 1 } })
    .sort({ order: 1 })
    .toArray();
  if (!questions.length) throw new HttpError(409, "No questions have been added yet.");
  const questionIds = questions.map((q) => q._id.toHexString()); // frozen at start

  // Sequential number the admin sees ("Test #12").
  const counter = await db
    .collection("counters")
    .findOneAndUpdate({ _id: "attempts" }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });

  try {
    const { insertedId } = await attempts.insertOne({
      sid: auth.sub,
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
      const winner = await attempts.findOne({ sid: auth.sub, status: "in-progress" });
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

  const answers = {};
  scoredIds.forEach((id) => {
    if (typeof sent[id] === "string" && v.LETTERS.includes(sent[id])) answers[id] = sent[id];
  });

  const config = await loadConfig(db);
  const total = scoredIds.length;
  const score = scoredIds.filter((id) => answers[id] === correct[id]).length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  const result = {
    score,
    total,
    percent,
    passed: percent >= config.passPercent,
    passPercent: config.passPercent,
    correct,
  };

  const done = await attempts.findOneAndUpdate(
    { _id: attemptId, sid: auth.sub, status: "in-progress" },
    { $set: { ...result, answers, status: "completed", finishedAt: new Date() } },
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

route("GET", "/admin/questions", "admin", async ({ db }) => {
  const questions = await db.collection("questions").find({}).sort({ order: 1 }).toArray();
  return json(200, { questions: questions.map(adminQuestion) });
});

const nextOrder = async (db) => {
  const last = await db.collection("questions").find({}, { projection: { order: 1 } }).sort({ order: -1 }).limit(1).toArray();
  return (last[0]?.order || 0) + 1;
};

route("POST", "/admin/questions", "admin", async ({ db, body }) => {
  const q = v.question(await body());
  const { insertedId } = await db.collection("questions").insertOne({ ...q, order: await nextOrder(db) });
  return json(201, { id: insertedId.toHexString() });
});

route("POST", "/admin/questions/swap", "admin", async ({ db, body }) => {
  const input = v.object(await body());
  const a = v.objectId(input.a, "first question");
  const b = v.objectId(input.b, "second question");
  const docs = await db.collection("questions").find({ _id: { $in: [a, b] } }, { projection: { order: 1 } }).toArray();
  if (docs.length !== 2) throw new HttpError(404, "Question not found.");
  const [first, second] = docs;
  await db.collection("questions").bulkWrite([
    { updateOne: { filter: { _id: first._id }, update: { $set: { order: second.order } } } },
    { updateOne: { filter: { _id: second._id }, update: { $set: { order: first.order } } } },
  ]);
  return json(200, { ok: true });
});

route("POST", "/admin/questions/import", "admin", async ({ db, body }) => {
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
  if (input.mode === "replace") await questions.deleteMany({});
  else start = await nextOrder(db);
  await questions.insertMany(cleaned.map((q, i) => ({ ...q, order: start + i })));
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

route("GET", "/admin/config", "admin", async ({ db }) => json(200, { config: await loadConfig(db) }));

route("PUT", "/admin/config", "admin", async ({ db, body }) => {
  const input = v.object(await body());
  if (typeof input.active !== "boolean") throw new HttpError(400, "Active must be true or false.");
  const config = {
    title: v.text(input.title, "Title", { max: 120 }),
    passPercent: v.integer(input.passPercent, "Pass mark", { min: 1, max: 100 }),
    active: input.active,
  };
  await db.collection("config").updateOne({ _id: "test" }, { $set: config }, { upsert: true });
  return json(200, { config });
});

// Every attempt with its warnings. The admin panel polls this for live updates.
route("GET", "/admin/attempts", "admin", async ({ db }) => {
  const rows = await db
    .collection("attempts")
    .aggregate([
      { $sort: { startedAt: -1 } },
      { $limit: 500 },
      { $lookup: { from: "violations", localField: "_id", foreignField: "attemptId", as: "violations" } },
      { $project: { sid: 0 } },
    ])
    .toArray();
  return json(200, {
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
