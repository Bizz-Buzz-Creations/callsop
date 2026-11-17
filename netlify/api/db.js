import { MongoClient, ObjectId } from "mongodb";
import { ConfigError } from "./http.js";

// The connection is created once per server process and reused across
// requests (important for serverless functions).
let clientPromise;
let indexesReady;

// Fixed id for the test created from data saved before "multiple tests" existed,
// so two servers starting at the same moment cannot create it twice.
export const LEGACY_TEST_ID = "000000000000000000000001";

// Before there were several tests, the questions and attempts had no testId and the
// settings lived in config/test. Turn that into ONE test and attach the old data to
// it. Safe to run any number of times: it does nothing once nothing is left over.
export const migrateToMultipleTests = async (db) => {
  const questions = db.collection("questions");
  const attempts = db.collection("attempts");
  const [orphanQuestions, orphanAttempts] = await Promise.all([
    questions.countDocuments({ testId: { $exists: false } }),
    attempts.countDocuments({ testId: { $exists: false } }),
  ]);
  if (!orphanQuestions && !orphanAttempts) return;

  const legacy = await db.collection("config").findOne({ _id: "test" });
  const title = legacy?.title || "Call Disposition Assessment";
  await db.collection("tests").updateOne(
    { _id: new ObjectId(LEGACY_TEST_ID) },
    {
      $setOnInsert: {
        title,
        description: "",
        passPercent: legacy?.passPercent ?? 70,
        active: legacy?.active !== false,
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
  await questions.updateMany({ testId: { $exists: false } }, { $set: { testId: LEGACY_TEST_ID } });
  await attempts.updateMany({ testId: { $exists: false } }, { $set: { testId: LEGACY_TEST_ID, testTitle: title } });
};

const ensureIndexes = async (db) => {
  // The old rule "one running attempt per browser" would stop an agent from having
  // a running attempt in two different tests. It is replaced by one per test below.
  const attempts = db.collection("attempts");
  // (A fresh database has no such index, or not even the collection yet: ignore that.)
  await attempts.dropIndex("sid_1").catch(() => {});

  await Promise.all([
    db.collection("admins").createIndex({ email: 1 }, { unique: true }),
    db.collection("questions").createIndex({ testId: 1, order: 1 }),
    // At most ONE in-progress attempt per browser session PER TEST, enforced by the DB.
    attempts.createIndex(
      { sid: 1, testId: 1 },
      { unique: true, partialFilterExpression: { status: "in-progress" } }
    ),
    attempts.createIndex({ startedAt: -1 }),
    attempts.createIndex({ testId: 1 }),
    db.collection("violations").createIndex({ attemptId: 1 }),
    db.collection("ipRules").createIndex({ value: 1 }, { unique: true }),
    // Failed-login records expire by themselves after 15 minutes.
    db.collection("loginFailures").createIndex({ at: 1 }, { expireAfterSeconds: 900 }),
  ]);

  await migrateToMultipleTests(db);
};

export const getDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new ConfigError("MONGODB_URI is not set.");

  clientPromise ||= new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
  })
    .connect()
    .catch((err) => {
      clientPromise = undefined; // let the next request retry
      throw err;
    });

  const client = await clientPromise;
  // Use a separate database so this app never touches your other apps' data.
  const db = client.db(process.env.MONGODB_DB || "callsop");
  indexesReady ||= ensureIndexes(db).catch((err) => {
    indexesReady = undefined;
    throw err;
  });
  await indexesReady;
  return db;
};

export const closeDb = async () => {
  if (clientPromise) (await clientPromise).close();
  clientPromise = undefined;
  indexesReady = undefined;
};
