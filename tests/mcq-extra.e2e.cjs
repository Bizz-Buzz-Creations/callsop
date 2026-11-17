// MCQ edge cases: empty bank, closed test, two agents at once, phone width,
// exam-mode protections, admin sessions. See tests/README.md.
const path = require("path");
const os = require("os");
const { BASE, bank, createRunner, launch, reset, seedAdmin, requireTestApi, adminToken, createTest, importQuestions, bankQuestions, updateTest, displayOrder, answerBank } = require("./lib.cjs");

const { ok, group, finish } = createRunner();
const key = bank.map((q) => "ABCD".indexOf(q.answer));

(async () => {
  await reset();
  await seedAdmin("boss@example.com", "correct-horse-1");
  await requireTestApi("boss@example.com", "correct-horse-1");
  const tok = await adminToken("boss@example.com", "correct-horse-1");

  const browser = await launch();
  const errors = [];
  const mk = async (label, viewport = { width: 1200, height: 900 }) => {
    const page = await (await browser.newContext({ viewport })).newPage();
    page.on("pageerror", (e) => errors.push(`${label}: ${e}`));
    page.on("dialog", (d) => d.accept());
    return page;
  };
  const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const TITLE = "Disposition Test";
  const startAs = async (p, name) => { await p.getByLabel("Your name").fill(name); await p.getByRole("button", { name: "Start Test" }).click(); };
  // From the list of tests: open the test's card, then start it.
  const startFromList = async (p, name) => {
    await p.goto(`${BASE}/test`);
    await p.getByRole("article", { name: TITLE }).getByRole("link").click();
    await startAs(p, name);
  };
  let testId;

  const ann = await mk("ann", { width: 375, height: 800 }); // a phone
  const bob = await mk("bob");
  const admin = await mk("admin");

  await group("a test with no questions, and a closed test", async () => {
    testId = await createTest(tok, { title: TITLE, passPercent: 70 });
    await ann.goto(`${BASE}/test`);
    await ann.getByText("No tests are available right now.").waitFor();
    ok("an empty test is NOT offered on the list", true);
    ok("the list fits a 375px phone (no sideways scroll)", (await overflow(ann)) <= 1, await overflow(ann));

    await ann.goto(`${BASE}/test/${testId}`); // someone with the direct link
    await ann.getByRole("button", { name: "Start Test" }).waitFor();
    ok("start screen fits a 375px phone (no sideways scroll)", (await overflow(ann)) <= 1, await overflow(ann));
    ok("start screen asks for a name only", (await ann.locator("input").count()) === 1);
    await startAs(ann, "Ann Lee");
    await ann.getByText("No questions have been added to this test yet.").waitFor();
    ok("starting an empty test -> clear message, no crash", true);

    await updateTest(tok, testId, { title: TITLE, passPercent: 70, active: false });
    await ann.reload();
    await ann.getByText("This test is not open right now.").first().waitFor();
    ok("closed test: message shown", true);
    await ann.getByLabel("Your name").fill("Ann Lee");
    ok("closed test: Start is disabled even with a name", await ann.getByRole("button", { name: "Start Test" }).isDisabled());
    ok("closed test shows the test's title", (await ann.getByRole("heading", { name: TITLE }).count()) === 1);
    await updateTest(tok, testId, { title: TITLE, passPercent: 70, active: true });
    await importQuestions(tok, testId, bankQuestions);
  });

  await group("admin watches two agents at once", async () => {
    await admin.goto(`${BASE}/test/admin`);
    await admin.getByLabel("Username").fill("boss@example.com");
    await admin.getByLabel("Password").fill("correct-horse-1");
    await admin.getByRole("button", { name: "Log in" }).click();
    await admin.getByRole("button", { name: "Attempts", exact: true }).click();
    await admin.getByText("No attempts yet.").waitFor();

    await startFromList(ann, "Ann Lee");
    await ann.locator("fieldset").first().waitFor();
    await startFromList(bob, "Bob Ray");
    await bob.locator("fieldset").first().waitFor();
    await admin.waitForFunction(() => document.querySelectorAll("tbody tr").length === 2, null, { timeout: 10000 });
    ok("admin sees both agents by name", (await admin.locator("tbody tr").filter({ hasText: "Ann Lee" }).count()) === 1 && (await admin.locator("tbody tr").filter({ hasText: "Bob Ray" }).count()) === 1);

    const bobOrder = await displayOrder(bob);
    for (let i = 0; i < 5; i++) await answerBank(bob, bobOrder, i, key[i]);
    await admin.getByText("In progress (5/30 answered)").waitFor({ timeout: 10000 });
    ok("admin sees Bob's answer count update (5/30)", true);

    await bob.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
    await admin.locator("div.bg-red-600", { hasText: `Bob Ray (Attempt #2, ${TITLE})` }).first().waitFor({ timeout: 10000 });
    ok("alert names Bob Ray, the attempt and the test", true);
    ok("no alert for Ann Lee", (await admin.locator("div.bg-red-600", { hasText: "Ann Lee" }).count()) === 0);
    const rows = {};
    for (const r of await admin.locator("tbody tr").all()) { const t = (await r.innerText()).replace(/\s+/g, " "); if (t.startsWith(`Ann Lee ${TITLE} #1 `)) rows.ann = t; if (t.startsWith(`Bob Ray ${TITLE} #2 `)) rows.bob = t; }
    ok("per-row warning counts: Ann 0, Bob 1", / 0 Details/.test(rows.ann) && / 1 Details/.test(rows.bob), JSON.stringify(rows));
  });

  await group("exam-mode protections (while a test is running)", async () => {
    const probe = (p) => p.evaluate(() => {
      const ctx = new MouseEvent("contextmenu", { cancelable: true, bubbles: true });
      document.body.dispatchEvent(ctx);
      const copy = new Event("copy", { cancelable: true, bubbles: true });
      document.dispatchEvent(copy);
      const unload = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(unload);
      return { contextmenu: ctx.defaultPrevented, copy: copy.defaultPrevented, beforeunload: unload.defaultPrevented };
    });
    const during = await probe(ann);
    ok("right-click blocked during test", during.contextmenu);
    ok("copy blocked during test", during.copy);
    ok("leaving the page asks for confirmation (beforeunload)", during.beforeunload);
    ok("running test fits a 375px phone", (await overflow(ann)) <= 1, await overflow(ann));
    const idle = await (async () => { const p = await mk("idle"); await p.goto(`${BASE}/test`); await p.getByRole("heading", { name: "Tests", exact: true }).waitFor(); return probe(p); })();
    ok("protections are OFF outside a running test", !idle.contextmenu && !idle.copy && !idle.beforeunload, JSON.stringify(idle));

    const annOrder = await displayOrder(ann);
    for (let i = 0; i < 30; i++) await answerBank(ann, annOrder, i, key[i]);
    await ann.getByRole("button", { name: "Submit Test" }).click();
    await ann.getByRole("button", { name: "Yes, submit" }).click();
    await ann.getByRole("heading", { name: "Your Result" }).waitFor({ timeout: 15000 });
    ok("submitting records NO warning (the confirmation is in the page, not a browser pop-up)", (await ann.getByText("0 tab/window switches recorded").count()) === 1);
    ok("perfect score 30 / 30 (100%)", (await ann.locator("p.text-3xl").innerText()).replace(/\s+/g, " ") === "30 / 30 (100%)");
    ok("result page fits a 375px phone", (await overflow(ann)) <= 1, await overflow(ann));
    const after = await probe(ann);
    ok("protections released after submit", !after.contextmenu && !after.copy && !after.beforeunload, JSON.stringify(after));
    await ann.screenshot({ path: path.join(os.tmpdir(), "mcq-mobile-result.png") });
    await admin.getByText("30 / 30 (100%)").first().waitFor({ timeout: 10000 });
    ok("admin sees Ann's 30/30 while Bob is still in progress", (await admin.getByText("In progress (5/30 answered)").count()) === 1);
  });

  await group("resume and answer persistence", async () => {
    await bob.reload();
    await bob.locator("fieldset").first().waitFor();
    ok("Bob resumes with his 5 answers after a reload", (await bob.getByText("Answered 5 / 30").count()) === 1);
    ok("an in-progress agent goes straight back to the test", (await bob.locator("fieldset").count()) === 30);
  });

  await group("admin session handling", async () => {
    // Agent and admin in the SAME browser profile do not interfere.
    const sameBrowser = await admin.context().newPage();
    await startFromList(sameBrowser, "Cy Dee");
    await sameBrowser.locator("fieldset").first().waitFor();
    ok("an agent can take the test in the admin's own browser", (await sameBrowser.locator("fieldset").count()) === 30);
    await admin.reload();
    await admin.getByRole("heading", { name: "Test Admin Panel" }).waitFor();
    ok("the admin stays logged in after a reload", (await admin.locator("table").count()) === 1);
    await admin.getByRole("button", { name: "Attempts", exact: true }).click();
    await admin.getByText("3 attempt(s)").waitFor({ timeout: 10000 });
    ok("admin sees the third test", true);

    await admin.getByRole("button", { name: "Log out" }).click();
    await admin.getByLabel("Username").waitFor();
    ok("log out returns to the login form", (await admin.locator("table").count()) === 0);
    await admin.goto(`${BASE}/test/admin`);
    await admin.getByLabel("Username").waitFor();
    ok("revisiting the admin URL after logout asks for login again", (await admin.locator("table").count()) === 0);
    const agentOnAdmin = await mk("agent-on-admin");
    await agentOnAdmin.goto(`${BASE}/test`); // gets an agent session
    await agentOnAdmin.getByRole("heading", { name: "Tests", exact: true }).waitFor();
    await agentOnAdmin.goto(`${BASE}/test/admin`);
    await agentOnAdmin.getByLabel("Username").waitFor();
    ok("an agent's session does NOT unlock the admin panel", (await agentOnAdmin.locator("table").count()) === 0);
    await admin.getByLabel("Username").fill("boss@example.com");
    await admin.getByLabel("Password").fill("correct-horse-1");
    await admin.getByRole("button", { name: "Log in" }).click();
    await admin.getByRole("button", { name: "Attempts", exact: true }).click();
    await admin.getByText("3 attempt(s)").waitFor({ timeout: 10000 });
    ok("logging back in shows the existing attempts", true);
    await admin.getByRole("button", { name: "Tests", exact: true }).click();
    await admin.getByRole("button", { name: "Edit" }).click();
    await admin.getByText("30 question(s)").waitFor();
    ok("question bank intact (30)", true);
    ok("question cards show the correct answers to the admin", (await admin.locator("li.text-green-600").count()) === 30);
  });

  await group("a stolen or expired admin session", async () => {
    // Deleting the admin from the database must lock out a live session at once.
    const gone = await mk("gone");
    await gone.goto(`${BASE}/test/admin`);
    await gone.getByLabel("Username").fill("boss@example.com");
    await gone.getByLabel("Password").fill("correct-horse-1");
    await gone.getByRole("button", { name: "Log in" }).click();
    await gone.getByRole("heading", { name: "Test Admin Panel" }).waitFor();
    await gone.getByRole("button", { name: "Attempts", exact: true }).click(); // this tab polls every few seconds
    await require("./lib.cjs").withDb((db) => db.collection("admins").deleteMany({}));
    // The next poll gets a 401.
    await gone.getByLabel("Username").waitFor({ timeout: 10000 });
    ok("removing the admin sends their open panel back to login within seconds", true);
  });

  ok("no uncaught page errors in any session", errors.length === 0, errors.join(" | "));
  await finish(browser);
})().catch((e) => { console.error("CRASHED", e); process.exit(2); });
