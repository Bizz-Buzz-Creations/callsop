// Creates an admin (or resets that admin's password).
//   npm run create-admin -- admin
// The username can be anything (an email is fine too). The password is typed hidden at a prompt. For automation you can set
// ADMIN_PASSWORD instead. Needs MONGODB_URI in .env.
import { closeDb, getDb } from "../netlify/api/db.js";
import { hashPassword } from "../netlify/api/security.js";

const askHidden = (prompt) =>
  new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(prompt);
    if (!stdin.isTTY) {
      // piped input (no echo to hide)
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (data += chunk));
      stdin.on("end", () => resolve(data.split("\n")[0].replace(/\r$/, "")));
      return;
    }
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (char) => {
      if (char === "\r" || char === "\n") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (char === "\u0003") {
        process.exit(130); // Ctrl-C
      } else if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on("data", onData);
  });

const main = async () => {
  const email = (process.argv[2] || "").trim().toLowerCase(); // stored as the login username
  if (!email) {
    console.error("Usage: npm run create-admin -- admin");
    process.exit(1);
  }

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await askHidden("New admin password (min 4 characters): ");
    if (process.stdin.isTTY) {
      const again = await askHidden("Type it again: ");
      if (again !== password) {
        console.error("Passwords do not match.");
        process.exit(1);
      }
    }
  }
  if (password.length < 4) {
    console.error("Password must be at least 4 characters.");
    process.exit(1);
  }

  const db = await getDb();
  const passwordHash = await hashPassword(password);
  const res = await db.collection("admins").updateOne(
    { email },
    { $set: { passwordHash }, $setOnInsert: { email, createdAt: new Date() } },
    { upsert: true }
  );
  console.log(res.upsertedCount ? `Admin created: ${email}` : `Password updated for: ${email}`);
  await closeDb();
};

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
