// Puts the built-in questions (src/assets/mcqTest.json) into ONE test in the database.
//   npm run seed-questions                       adds them to the test "Call Disposition Assessment"
//                                                (created if it does not exist), if that test has no questions
//   npm run seed-questions -- --replace          replaces that test's questions
//   npm run seed-questions -- --test <id> ...    uses the test with this id instead (see the admin panel's address bar)
// Only the chosen test is touched; other tests keep their questions.
// Needs MONGODB_URI in .env. Questions can also be added in the admin panel.
import { readFileSync } from "node:fs";
import { ObjectId } from "mongodb";
import { closeDb, getDb } from "../netlify/api/db.js";
import * as v from "../netlify/api/validate.js";

const DEFAULT_TITLE = "Call Disposition Assessment";
const { questions } = JSON.parse(readFileSync(new URL("../src/assets/mcqTest.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
const replace = args.includes("--replace");
const idIndex = args.indexOf("--test");
const wantedId = idIndex >= 0 ? args[idIndex + 1] : null;

try {
  const cleaned = questions.map((q, i) => v.question(q, `Question ${i + 1}`)); // same rules as the admin panel
  const db = await getDb();
  const tests = db.collection("tests");

  let test;
  if (wantedId) {
    if (!ObjectId.isValid(wantedId) || wantedId.length !== 24) throw new Error(`"${wantedId}" is not a test id.`);
    test = await tests.findOne({ _id: new ObjectId(wantedId) });
    if (!test) throw new Error(`There is no test with the id ${wantedId}.`);
  } else {
    test = await tests.findOne({ title: DEFAULT_TITLE });
    if (!test) {
      const { insertedId } = await tests.insertOne({
        title: DEFAULT_TITLE,
        description: "",
        passPercent: 70,
        active: true,
        createdAt: new Date(),
      });
      test = await tests.findOne({ _id: insertedId });
      console.log(`Created the test "${DEFAULT_TITLE}".`);
    }
  }

  const testId = test._id.toHexString();
  const col = db.collection("questions");
  const existing = await col.countDocuments({ testId });
  if (existing && !replace) {
    console.log(`"${test.title}" already has ${existing} question(s). Nothing changed. Use --replace to overwrite them.`);
  } else {
    if (replace) await col.deleteMany({ testId });
    await col.insertMany(cleaned.map((q, i) => ({ ...q, testId, order: i + 1 })));
    console.log(`Added ${cleaned.length} questions to "${test.title}" (${testId}).`);
  }
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
