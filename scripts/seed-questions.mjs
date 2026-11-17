// Puts the built-in questions (src/assets/mcqTest.json) into the database.
//   npm run seed-questions              adds them if the question list is empty
//   npm run seed-questions -- --replace replaces whatever is there
// Needs MONGODB_URI in .env. Questions can also be added in the admin panel.
import { readFileSync } from "node:fs";
import { closeDb, getDb } from "../netlify/api/db.js";
import * as v from "../netlify/api/validate.js";

const { questions } = JSON.parse(readFileSync(new URL("../src/assets/mcqTest.json", import.meta.url), "utf8"));
const replace = process.argv.includes("--replace");

try {
  const cleaned = questions.map((q, i) => v.question(q, `Question ${i + 1}`)); // same rules as the admin panel
  const col = (await getDb()).collection("questions");
  const existing = await col.countDocuments();
  if (existing && !replace) {
    console.log(`The database already has ${existing} question(s). Nothing changed. Use --replace to overwrite them.`);
  } else {
    if (replace) await col.deleteMany({});
    await col.insertMany(cleaned.map((q, i) => ({ ...q, order: i + 1 })));
    console.log(`Added ${cleaned.length} questions to the database.`);
  }
} catch (err) {
  console.error("Failed:", err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
