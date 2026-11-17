// Multiple tests, end to end in real browsers: the admin creates different tests,
// agents pick one from the list and take it. See tests/README.md.
const { BASE, createRunner, launch, reset, seedAdmin, requireTestApi, adminToken, simpleQuestions, updateTest, withDb, api, ROOT } = require("./lib.cjs");

const { ok, group, finish } = createRunner();

(async () => {
  await reset();
  await seedAdmin("boss@example.com", "correct-horse-1");
  await requireTestApi("boss@example.com", "correct-horse-1");
  const tok = await adminToken("boss@example.com", "correct-horse-1");

  const browser = await launch();
  const errors = [];
  const mk = async (label, width = 1200) => {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    page.on("pageerror", (e) => errors.push(`${label}: ${e}`));
    page.on("dialog", (d) => d.accept());
    return page;
  };
  const admin = await mk("admin");
  const agent = await mk("agent");
  const card = (page, title) => page.getByRole("article", { name: title });
  const cardTitles = (page) => page.locator("article h2").allInnerTexts();
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const goList = async (page) => {
    await page.goto(`${BASE}/test`);
    await page.getByRole("heading", { name: "Tests", exact: true }).waitFor();
    await page.getByText("Loading tests…").waitFor({ state: "detached" });
  };
  const startAs = async (page, name) => {
    await page.getByLabel("Your name").fill(name);
    await page.getByRole("button", { name: "Start Test" }).click();
  };
  // Answers every question with the letter at `index` (0 = A) and submits.
  const answerAll = async (page, index) => {
    const n = await page.locator("fieldset").count();
    for (let i = 0; i < n; i++) await page.locator("fieldset").nth(i).locator('input[type="radio"]').nth(index).check();
    await page.getByRole("button", { name: "Submit Test" }).click();
    await page.getByRole("button", { name: "Yes, submit" }).click();
    await page.getByRole("heading", { name: "Your Result" }).waitFor({ timeout: 15000 });
  };
  const updateTestByTitle = async (title, fields) => {
    const { data } = await api("GET", "/admin/tests", { token: tok });
    const t = data.tests.find((x) => x.title === title);
    await updateTest(tok, t.id, { title: t.title, description: t.description, passPercent: t.passPercent, active: true, ...fields });
    return t.id;
  };
  const loginAdmin = async () => {
    await admin.goto(`${BASE}/test/admin`);
    await admin.getByLabel("Username").fill("boss@example.com");
    await admin.getByLabel("Password").fill("correct-horse-1");
    await admin.getByRole("button", { name: "Log in" }).click();
    await admin.getByRole("heading", { name: "Test Admin Panel" }).waitFor();
  };
  const row = (title) => admin.locator("tbody tr", { has: admin.locator("p.font-semibold", { hasText: title }) });

  await group("the list is empty before the admin creates anything", async () => {
    await goList(agent);
    await agent.getByText("No tests are available right now.").waitFor();
    ok("empty state shown, no Start buttons", (await agent.getByRole("link", { name: "Start test" }).count()) === 0);
    ok("the Admin panel link is there", (await agent.getByRole("link", { name: "Admin panel" }).count()) === 1);
  });

  await group("admin creates several different tests in the browser", async () => {
    await loginAdmin();
    await admin.getByText("No tests yet.").waitFor();
    ok("the admin lands on the Tests tab", (await admin.getByRole("button", { name: "New test" }).count()) === 1);

    // Validation first
    await admin.getByRole("button", { name: "New test" }).click();
    await admin.getByRole("button", { name: "Create test" }).click();
    await admin.getByText("Enter a title for the test.").waitFor();
    ok("a test without a title is refused", true);
    await admin.getByLabel("Title").fill("Quick quiz");
    await admin.getByLabel("Pass mark (%)").fill("150");
    await admin.getByRole("button", { name: "Create test" }).click();
    // The browser itself refuses a number above the field's max (100) before the app sees the form.
    ok("a pass mark of 150 is refused (nothing is created)", (await admin.getByLabel("Pass mark (%)").evaluate((el) => !el.validity.valid)) && (await admin.getByText("0 test(s)").count()) === 1);

    // Test A: easy, low pass mark, 3 questions (all answers are B)
    await admin.getByLabel("Pass mark (%)").fill("50");
    await admin.getByLabel("Description (optional)").fill("Three easy questions.");
    await admin.getByRole("button", { name: "Create test" }).click();
    await admin.getByRole("heading", { name: "Test details" }).waitFor();
    await admin.getByRole("button", { name: "Import from JSON" }).click();
    await admin.getByPlaceholder("Paste questions JSON here").fill(JSON.stringify(simpleQuestions(3, "Easy")));
    await admin.getByRole("button", { name: "Replace all" }).click();
    await admin.getByText("Imported 3 question(s).").waitFor({ timeout: 15000 });
    ok("test A has 3 questions", (await admin.getByText("3 question(s)").count()) >= 1);
    await admin.getByRole("button", { name: "← All tests" }).click();

    // Test B: strict, high pass mark, 4 questions, created through the form with Add question
    await admin.getByRole("button", { name: "New test" }).click();
    await admin.getByLabel("Title").fill("Strict exam");
    await admin.getByLabel("Description (optional)").fill("Needs 100%.");
    await admin.getByLabel("Pass mark (%)").fill("100");
    await admin.getByRole("button", { name: "Create test" }).click();
    await admin.getByRole("heading", { name: "Test details" }).waitFor();
    await admin.getByRole("button", { name: "Add question" }).click();
    await admin.getByPlaceholder("Question text").fill("Hand-made question?");
    const opts = admin.locator("form input.flex-1");
    for (let i = 0; i < 4; i++) await opts.nth(i).fill(`Choice ${"ABCD"[i]}`);
    await admin.getByLabel("Option C is correct").check();
    await admin.getByRole("button", { name: "Save", exact: true }).click();
    await admin.getByText("1 question(s)").first().waitFor({ timeout: 15000 });
    ok("the form-made question is saved in the new test", true);
    await admin.getByRole("button", { name: "Import from JSON" }).click();
    await admin.getByPlaceholder("Paste questions JSON here").fill(JSON.stringify(simpleQuestions(3, "Hard")));
    await admin.getByRole("button", { name: "Append to existing" }).click();
    await admin.getByText("4 question(s)").first().waitFor({ timeout: 15000 });
    await admin.getByRole("button", { name: "← All tests" }).click();

    // Test C: created but left empty
    await admin.getByRole("button", { name: "New test" }).click();
    await admin.getByLabel("Title").fill("Work in progress");
    await admin.getByRole("button", { name: "Create test" }).click();
    await admin.getByRole("heading", { name: "Test details" }).waitFor();
    await admin.getByText("No questions in this test yet").waitFor();
    await admin.getByRole("button", { name: "← All tests" }).click();

    await admin.getByText("3 test(s)").waitFor();
    ok("the admin sees all 3 tests with their question counts", (await row("Quick quiz").count()) === 1 && (await row("Strict exam").innerText()).replace(/\s+/g, " ").includes("4 100% 0 Open"));
    ok("the empty test is flagged as invisible to agents", (await row("Work in progress").innerText()).includes("No questions: agents can't see it yet"));
  });

  await group("the agent list shows exactly what agents can take", async () => {
    await goList(agent);
    const titles = (await cardTitles(agent)).sort();
    ok("two tests with questions are listed, the empty one is hidden", JSON.stringify(titles) === JSON.stringify(["Quick quiz", "Strict exam"]), JSON.stringify(titles));
    const quick = await card(agent, "Quick quiz").innerText();
    ok("card shows description, size, pass mark, status", quick.includes("Three easy questions.") && quick.includes("3 questions · pass mark 50%") && quick.includes("Not attempted yet"));
    const strict = await card(agent, "Strict exam").innerText();
    ok("a different test has its own settings", strict.includes("4 questions · pass mark 100%"));
    ok("every card has a Start button", (await agent.getByRole("link", { name: "Start test" }).count()) === 2);
    ok("the list fits a 375px phone", await (async () => { const p = await mk("phone", 375); await goList(p); return (await overflow(p)) <= 1; })());
  });

  await group("an agent takes the easy test and passes", async () => {
    await card(agent, "Quick quiz").getByRole("link", { name: "Start test" }).click();
    await agent.getByRole("heading", { name: "Quick quiz" }).waitFor();
    ok("start screen shows this test's settings", (await agent.getByText("3 multiple-choice questions. Pass mark: 50%.").count()) === 1);
    await startAs(agent, "Dana Agent");
    await agent.locator("fieldset").first().waitFor();
    ok("only this test's 3 questions are shown", (await agent.locator("fieldset").count()) === 3);
    ok("none of the other test's questions leak in", (await agent.locator("fieldset p.font-medium", { hasText: "Hard" }).count()) === 0);
    await answerAll(agent, 1);
    ok("result 3 / 3 for the easy test", (await agent.locator("p.text-3xl").innerText()).replace(/\s+/g, " ") === "3 / 3 (100%)");
    ok("the result names the test", (await agent.getByText("Quick quiz").count()) >= 1);
    await agent.getByRole("link", { name: "Back to all tests" }).click();
    await card(agent, "Quick quiz").waitFor();
    const after = await card(agent, "Quick quiz").innerText();
    ok("list: easy test shows 'Last result: 3/3' and Take again", after.includes("Last result: 3/3 (100%)") && after.includes("Passed") && (await card(agent, "Quick quiz").getByRole("link", { name: "Take again" }).count()) === 1);
    ok("the other test is unaffected (not attempted)", (await card(agent, "Strict exam").innerText()).includes("Not attempted yet"));
  });

  await group("two tests in progress at once, with a refresh in between", async () => {
    await card(agent, "Strict exam").getByRole("link", { name: "Start test" }).click();
    ok("name remembered from the first test", (await agent.getByLabel("Your name").inputValue()) === "Dana Agent");
    await agent.getByRole("button", { name: "Start Test" }).click();
    await agent.locator("fieldset").first().waitFor();
    ok("the strict test shows its 4 questions", (await agent.locator("fieldset").count()) === 4);
    await agent.locator("fieldset").first().locator('input[type="radio"]').first().check();
    await agent.getByText("Answered 1 / 4").waitFor();
    await agent.reload();
    await agent.locator("fieldset").first().waitFor();
    ok("a refresh resumes the strict test with its answer", (await agent.getByText("Answered 1 / 4").count()) === 1);
    await agent.goto(`${BASE}/test`);
    await card(agent, "Strict exam").waitFor();
    await agent.getByText("Loading tests…").waitFor({ state: "detached" });
    const status = await card(agent, "Strict exam").innerText();
    ok("the list shows 'In progress' and Resume", status.includes("In progress") && (await card(agent, "Strict exam").getByRole("link", { name: "Resume" }).count()) === 1);
    // A second test can be taken while this one is open
    await card(agent, "Quick quiz").getByRole("link", { name: "Take again" }).click();
    await agent.getByRole("button", { name: "Start Test" }).click();
    await agent.locator("fieldset").first().waitFor();
    ok("starting another test while one is open works", (await agent.locator("fieldset").count()) === 3);
    await goList(agent);
    await card(agent, "Quick quiz").getByText("In progress").waitFor();
    ok("both tests are now 'In progress'", (await agent.getByText("In progress").count()) === 2);
    await card(agent, "Strict exam").getByRole("link", { name: "Resume" }).click();
    await agent.locator("fieldset").first().waitFor();
    ok("Resume goes back to the strict test with its saved answer", (await agent.getByText("Answered 1 / 4").count()) === 1 && (await agent.locator("fieldset").count()) === 4);
  });

  await group("per-test pass marks: the strict test fails at 3 of 4", async () => {
    // Strict exam: question 1 is the hand-made one (answer C). Question order is shuffled, so
    // answer by text: choose the right option for each question.
    const n = await agent.locator("fieldset").count();
    for (let i = 0; i < n; i++) {
      const fs = agent.locator("fieldset").nth(i);
      const text = await fs.locator("p.font-medium").innerText();
      const letter = text.includes("Hand-made") ? 2 : 1; // C for the hand-made one, else B
      const wanted = text.includes("Hard1") ? 0 : letter; // get exactly one wrong
      await fs.locator('input[type="radio"]').nth(wanted).check();
    }
    await agent.getByRole("button", { name: "Submit Test" }).click();
    await agent.getByRole("button", { name: "Yes, submit" }).click();
    await agent.getByRole("heading", { name: "Your Result" }).waitFor({ timeout: 15000 });
    ok("3 / 4 (75%) shown", (await agent.locator("p.text-3xl").innerText()).replace(/\s+/g, " ") === "3 / 4 (75%)");
    ok("75% is a fail because this test needs 100%", (await agent.getByText("Not passed · pass mark 100%").count()) === 1);
    await agent.getByRole("link", { name: "Back to all tests" }).click();
    await card(agent, "Strict exam").getByText("Not passed").waitFor();
    ok("the list shows the failed status", true);
  });

  await group("admin sees every attempt, the Test column and the filter", async () => {
    await admin.getByRole("button", { name: "Attempts", exact: true }).click();
    await admin.getByText("3 attempt(s)").waitFor({ timeout: 10000 });
    const rows = (await admin.locator("tbody tr").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
    ok("the table names each test", rows.filter((r) => r.includes("Quick quiz")).length === 2 && rows.filter((r) => r.includes("Strict exam")).length === 1, JSON.stringify(rows));
    ok("attempt numbers are global (#1, #2, #3)", ["#1", "#2", "#3"].every((n) => rows.some((r) => r.includes(n + " "))));
    await admin.locator("#attempts-filter").selectOption({ label: "Strict exam" });
    await admin.getByText("1 attempt(s)").waitFor({ timeout: 10000 });
    ok("filtering by test shows only its attempts", (await admin.locator("tbody tr").count()) === 1 && (await admin.locator("tbody tr").first().innerText()).includes("Strict exam"));
    await admin.locator("tbody tr").first().getByRole("button", { name: "Details" }).click();
    ok("answer chips: 3 green, 1 red", (await admin.locator("span.bg-green-600.text-xs").count()) === 3 && (await admin.locator("span.bg-red-600.text-xs").count()) === 1);
    await admin.locator("#attempts-filter").selectOption({ label: "All tests" });
    await admin.getByText("3 attempt(s)").waitFor({ timeout: 10000 });
    ok("'All tests' shows everything again", true);
  });

  await group("proctoring alerts name the right test", async () => {
    // The agent has the strict test's attempt finished and the easy one in progress.
    await agent.goto(`${BASE}/test`);
    await agent.getByText("Loading tests…").waitFor({ state: "detached" });
    await card(agent, "Quick quiz").getByRole("link", { name: "Resume" }).click();
    await agent.locator("fieldset").first().waitFor();
    await agent.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("blur"));
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    });
    await agent.getByText("you left the test window").waitFor();
    await admin.getByText(/Dana Agent \(Attempt #\d, Quick quiz\)/).first().waitFor({ timeout: 10000 });
    ok("the admin's alert names the agent, the attempt and the test", true);
  });

  await group("admin edits details, opens/closes, renames", async () => {
    await admin.getByRole("button", { name: "Tests", exact: true }).click();
    await row("Quick quiz").getByRole("button", { name: "Edit" }).click();
    await admin.getByRole("heading", { name: "Test details" }).waitFor();
    await admin.getByLabel("Title").fill("Easy quiz");
    await admin.getByLabel("Test is open (agents can start it)").uncheck();
    await admin.getByRole("button", { name: "Save details" }).click();
    await admin.getByText("Saved.").waitFor();
    await admin.getByRole("button", { name: "← All tests" }).click();
    ok("the table shows the new title and 'Closed'", (await row("Easy quiz").innerText()).includes("Closed"));

    // Dana still has an unfinished attempt on it, so for Dana it stays on the list.
    await goList(agent);
    const kept = card(agent, "Easy quiz");
    await kept.waitFor();
    ok("the renamed test appears under its new title", (await cardTitles(agent)).includes("Easy quiz") && !(await cardTitles(agent)).includes("Quick quiz"));
    ok("a closed test with an open attempt is marked so the agent can finish it", (await kept.innerText()).includes("closed: you can still finish it"));
    await kept.getByRole("link", { name: "Resume" }).click();
    await agent.locator("fieldset").first().waitFor();
    ok("the agent can resume and finish a test that was closed meanwhile", (await agent.locator("fieldset").count()) === 3);
    await answerAll(agent, 1);
    ok("...and submit it", (await agent.getByRole("heading", { name: "Your Result" }).count()) === 1);

    // A fresh browser never sees the closed test.
    const fresh = await mk("fresh-closed");
    await goList(fresh);
    ok("a browser with no attempt does not see the closed test (only the open one)", (await cardTitles(fresh)).join() === "Strict exam", (await cardTitles(fresh)).join());
    await updateTestByTitle("Easy quiz", { active: true });
  });

  await group("a closed test: a fresh agent cannot start it, direct link says so", async () => {
    const closedId = await updateTestByTitle("Strict exam", { active: false });
    const fresh = await mk("fresh");
    await goList(fresh);
    ok("a fresh browser does not see the closed test", !(await cardTitles(fresh)).includes("Strict exam"));
    await fresh.goto(`${BASE}/test/${closedId}`);
    await fresh.getByText("This test is not open right now.").first().waitFor();
    await fresh.getByLabel("Your name").fill("Eve Agent");
    ok("Start is disabled on a closed test", await fresh.getByRole("button", { name: "Start Test" }).isDisabled());
    await updateTestByTitle("Strict exam", { active: true });
    await fresh.reload();
    await fresh.getByLabel("Your name").fill("Eve Agent");
    ok("re-opening it makes it startable again", await fresh.getByRole("button", { name: "Start Test" }).isEnabled());
  });

  await group("bad links never crash", async () => {
    const stray = await mk("stray");
    for (const [label, p] of [["an unknown id", "/test/000000000000000000000abc"], ["a malformed id", "/test/not-a-real-id"], ["junk", "/test/%20"]]) {
      await stray.goto(`${BASE}${p}`);
      await stray.getByText("Test not found").waitFor();
      ok(`${label}: friendly 'Test not found'`, (await stray.getByRole("link", { name: "See all tests" }).count()) === 1);
    }
    await stray.getByRole("link", { name: "See all tests" }).click();
    await stray.getByRole("heading", { name: "Tests", exact: true }).waitFor();
    ok("'See all tests' leads back to the list", true);
    await stray.goto(`${BASE}/test/admin`);
    await stray.getByLabel("Username").waitFor();
    ok("/test/admin is the admin login, not a test id", true);
  });

  await group("navbar highlights MCQ Test on every test page", async () => {
    const nav = await mk("nav");
    const active = async () => (await nav.locator("nav a", { hasText: "MCQ Test" }).first().evaluate((el) => el.className));
    await goList(nav);
    const onList = await active();
    await nav.locator("article").first().getByRole("link").click();
    await nav.getByRole("button", { name: "Start Test" }).waitFor();
    const onTest = await active();
    await nav.goto(`${BASE}/calculator`);
    const away = await active();
    ok("MCQ Test is highlighted on the list and on a test, not elsewhere", onList === onTest && onList !== away, `${onList} | ${onTest} | ${away}`);
    await goList(nav);
    await nav.locator("nav a", { hasText: "MCQ Test" }).first().click();
    await nav.getByRole("heading", { name: "Tests", exact: true }).waitFor();
    ok("clicking MCQ Test in the navbar lands on the list", true);
  });

  await group("duplicate, then delete with its attempts", async () => {
    await admin.getByRole("button", { name: "Tests", exact: true }).click();
    await row("Strict exam").getByRole("button", { name: "Duplicate" }).click();
    await admin.getByRole("heading", { name: "Test details" }).waitFor();
    ok("the copy opens in the editor, named '(copy)'", (await admin.getByLabel("Title").inputValue()).includes("(copy)"));
    ok("the copy has the 4 questions", (await admin.getByText("4 question(s)").count()) >= 1);
    ok("the copy is closed", !(await admin.getByLabel("Test is open (agents can start it)").isChecked()));
    await admin.getByRole("button", { name: "← All tests" }).click();
    ok("4 tests now", (await admin.getByText("4 test(s)").count()) === 1);
    await goList(agent);
    ok("the closed copy is not offered to agents", !(await cardTitles(agent)).some((t) => t.includes("(copy)")));

    await row("Strict exam").first().getByRole("button", { name: "Delete" }).click();
    await admin.getByText("3 test(s)").waitFor();
    ok("deleting a test removes it from the table", (await admin.getByText('Deleted "Strict exam".').count()) === 1);
    await goList(agent);
    ok("...and from the agents' list", !(await cardTitles(agent)).includes("Strict exam"));
    await admin.getByRole("button", { name: "Attempts", exact: true }).click();
    await admin.getByText("attempt(s)").first().waitFor();
    ok("its attempts went with it (the filter no longer lists it)", (await admin.locator("#attempts-filter option", { hasText: /^Strict exam$/ }).count()) === 0);
    const left = await withDb((db) => db.collection("attempts").countDocuments({ testTitle: "Strict exam" }));
    ok("nothing of the deleted test is left in the database", left === 0, left);
  });

  await group("legacy data (a single-test installation) shows up as one test", async () => {
    // Simulates the production database from before multiple tests existed.
    await withDb(async (db) => {
      await db.collection("tests").deleteMany({});
      await db.collection("questions").deleteMany({});
      await db.collection("attempts").deleteMany({});
      await db.collection("violations").deleteMany({});
      await db.collection("config").updateOne({ _id: "test" }, { $set: { title: "Old single test", passPercent: 60, active: true } }, { upsert: true });
      await db.collection("questions").insertMany(simpleQuestions(2, "Old").map((q, i) => ({ ...q, order: i + 1 })));
      await db.collection("attempts").insertOne({ sid: "legacy-sid", name: "Old Agent", attemptNo: 1, status: "completed", startedAt: new Date(), finishedAt: new Date(), questionIds: [], answers: {}, score: 1, total: 2, percent: 50, passed: false });
    });
    const { migrateToMultipleTests } = await import(`file://${ROOT}/netlify/api/db.js`);
    await withDb((db) => migrateToMultipleTests(db));
    await admin.reload();
    await admin.getByRole("heading", { name: "Test Admin Panel" }).waitFor();
    await admin.getByText("1 test(s)").waitFor();
    ok("the old test now appears with its title, 2 questions, 60% and 1 attempt", (await row("Old single test").innerText()).replace(/\s+/g, " ").includes("2 60% 1 Open"));
    const legacy = await mk("legacy");
    await goList(legacy);
    ok("agents see it on the list", (await cardTitles(legacy)).includes("Old single test"));
    await withDb((db) => db.collection("questions").deleteMany({}));
  });

  ok("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await finish(browser);
})().catch((e) => { console.error("E2E CRASHED", e); process.exit(2); });
