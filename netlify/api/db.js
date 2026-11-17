import { MongoClient } from "mongodb";
import { ConfigError } from "./http.js";

// The connection is created once per server process and reused across
// requests (important for serverless functions).
let clientPromise;
let indexesReady;

const ensureIndexes = async (db) => {
  await Promise.all([
    db.collection("admins").createIndex({ email: 1 }, { unique: true }),
    db.collection("questions").createIndex({ order: 1 }),
    // At most ONE in-progress attempt per browser session, enforced by the DB.
    db.collection("attempts").createIndex(
      { sid: 1 },
      { unique: true, partialFilterExpression: { status: "in-progress" } }
    ),
    db.collection("attempts").createIndex({ startedAt: -1 }),
    db.collection("violations").createIndex({ attemptId: 1 }),
    db.collection("ipRules").createIndex({ value: 1 }, { unique: true }),
    // Failed-login records expire by themselves after 15 minutes.
    db.collection("loginFailures").createIndex({ at: 1 }, { expireAfterSeconds: 900 }),
  ]);
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
