// Multiple tests, end to end in real browsers: the admin creates different tests,
// agents pick one from the list and take it. See tests/README.md.
const { BASE, createRunner, launch, reset, seedAdmin, requireTestApi, adminToken, createTest, importQuestions, simpleQuestions, updateTest, withDb, api, ROOT } = require("./lib.cjs");

const { ok, group, finish } = createRunner();

(async () => {
  await reset();
  await seedAdmin("boss@example.com", "correct-horse-1");
  await requireTestApi("boss@example.com", "correct-horse-1");
  const tok = await adminToken("boss@example.com", "correct-horse-1");

  const browser = await launch();
  const errors = [];
  const mk = async (label, width = 1200, initScript) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    if (initScript) await context.addInitScript(initScript);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`${label}: ${e}`));
    page.on("response", (r) => { if (r.status() >= 500) errors.push(`${label}: HTTP ${r.status()} ${r.url()}`); });
    // Every confirm() is recorded; page.dialogAction decides whether it is accepted or cancelled.
    page.dialogMessages = [];
    page.dialogAction = "accept";
    page.on("dialog", (d) => {
      page.dialogMessages.push(d.message());
      return page.dialogAction === "accept" ? d.accept() : d.dismiss();
    });
    return page;
  };
  // A new test with n simple questions (every correct answer is B), made through the API.
  const mkTest = async (title, n = 3, fields = {}) => {
    const id = await createTest(tok, { title, passPercent: 50, ...fields });
    await importQuestions(tok, id, simpleQuestions(n, `${title.slice(0, 4).replace(/\W/g, "")}-`));
    return id;
  };
  // Simulates the agent leaving the tab/window (real tab switches do not fire in automation).
  const leave = (page) => page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("blur"));
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  });
  const loginOn = async (page) => {
    await page.goto(`${BASE}/test/admin`);
    await page.getByLabel("Username").fill("boss@example.com");
    await page.getByLabel("Password").fill("correct-horse-1");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("heading", { name: "Test Admin Panel" }).waitFor();
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
    await admin.locator("tbody tr").first().getByText("Completed").waitFor({ timeout: 10000 });
    await admin.locator("tbody tr").first().getByRole("button", { name: "Details" }).click();
    await admin.getByText("Answers", { exact: true }).waitFor();
    const chipInfo = await admin.locator("tbody span.text-xs").evaluateAll((els) => els.map((e) => `${e.innerText}:${/bg-green-600/.test(e.className) ? "green" : /bg-red-600/.test(e.className) ? "red" : "grey"}`));
    ok("answer chips: 3 green, 1 red", chipInfo.filter((c) => c.endsWith("green")).length === 3 && chipInfo.filter((c) => c.endsWith("red")).length === 1, JSON.stringify(chipInfo));
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


  await group("live alerts reach the admin on every tab and under any filter", async () => {
    const id = await mkTest("Alert test", 3);
    await admin.goto(`${BASE}/test/admin`);
    await admin.getByRole("button", { name: "New test" }).waitFor(); // the Tests tab
    const zed = await mk("zed");
    await zed.goto(`${BASE}/test/${id}`);
    await startAs(zed, "Zed Agent");
    await zed.locator("fieldset").first().waitFor();
    await leave(zed);
    await zed.getByText("you left the test window").waitFor();
    await admin.getByRole("alert").filter({ hasText: /Zed Agent \(Attempt #\d+, Alert test\)/ }).waitFor({ timeout: 12000 });
    ok("a warning shows as a red alert while the admin is on the Tests tab", true);

    await admin.getByRole("button", { name: "Attempts", exact: true }).click();
    await admin.locator("#attempts-filter").selectOption({ label: "Old single test" }); // a test Zed is NOT in
    await zed.waitForTimeout(1200);
    await leave(zed);
    await admin.waitForFunction(() => document.querySelectorAll("[role=alert]").length >= 2, null, { timeout: 12000 });
    ok("...and while the table is filtered to a different test", true);

    await admin.getByRole("button", { name: "Access", exact: true }).click();
    await zed.waitForTimeout(1200);
    await leave(zed);
    await admin.waitForFunction(() => document.querySelectorAll("[role=alert]").length >= 3, null, { timeout: 12000 });
    ok("...and on the Access tab", true);

    await admin.getByRole("alert").first().getByRole("button", { name: "Dismiss" }).click();
    ok("an alert can be dismissed", (await admin.getByRole("alert").count()) === 2);
    await admin.getByRole("button", { name: "Attempts", exact: true }).click();
    await admin.locator("#attempts-filter").selectOption({ label: "All tests" });
    const zedRow = admin.locator("tbody tr", { hasText: "Zed Agent" });
    await zedRow.waitFor();
    ok("the table shows Zed's attempt in its test with 3 warnings", (await zedRow.first().innerText()).replace(/\s+/g, " ").includes("Alert test") && (await zedRow.first().locator("span.rounded-full").innerText()) === "3");
  });

  await group("the admin replaces a test's questions while agents are in the middle of it", async () => {
    const id = await mkTest("Replace me", 3);
    const a3 = await mk("a3");
    const a4 = await mk("a4");
    for (const [page, name] of [[a3, "Ann Three"], [a4, "Ann Four"]]) {
      await page.goto(`${BASE}/test/${id}`);
      await startAs(page, name);
      await page.locator("fieldset").first().waitFor();
      await page.locator("fieldset").first().locator('input[type="radio"]').nth(1).check();
      await page.getByText("Answered 1 / 3").waitFor();
    }
    await admin.goto(`${BASE}/test/admin`);
    await row("Replace me").getByRole("button", { name: "Edit" }).click();
    await admin.getByRole("heading", { name: "Test details" }).waitFor();
    await admin.getByRole("button", { name: "Import from JSON" }).click();
    await admin.getByPlaceholder("Paste questions JSON here").fill(JSON.stringify(simpleQuestions(2, "New-")));
    admin.dialogMessages.length = 0;
    await admin.getByRole("button", { name: "Replace all" }).click();
    await admin.getByText("Imported 2 question(s).").waitFor({ timeout: 15000 });
    ok("the confirmation warns that agents who are partway through must start again", admin.dialogMessages.some((m) => m.includes("partway through")), JSON.stringify(admin.dialogMessages));

    // Agent 3 carries on answering and submits.
    await a3.locator("fieldset").nth(1).locator('input[type="radio"]').nth(1).check();
    await a3.getByRole("button", { name: "Submit Test" }).click();
    await a3.getByRole("button", { name: "Yes, submit" }).click();
    await a3.getByRole("heading", { name: "This test is no longer running" }).waitFor();
    ok("submitting after the questions were replaced explains it (no made-up 0 / 0 result)", (await a3.getByRole("heading", { name: "Your Result" }).count()) === 0 && (await a3.getByRole("link", { name: "Back to all tests" }).count()) === 1);
    await a3.getByRole("button", { name: "Start again" }).click();
    await a3.getByRole("button", { name: "Start Test" }).waitFor();
    ok("'Start again' leads to the start screen with the name remembered", (await a3.getByLabel("Your name").inputValue()) === "Ann Three");
    await a3.getByRole("button", { name: "Start Test" }).click();
    await a3.locator("fieldset").first().waitFor();
    ok("the new attempt has the NEW questions", (await a3.locator("fieldset").count()) === 2 && (await a3.getByText("New-1").count()) === 1);

    // Agent 4 simply reloads.
    await a4.reload();
    await a4.getByRole("button", { name: "Start Test" }).waitFor();
    ok("after a reload the agent gets the start screen, not an empty test", (await a4.locator("fieldset").count()) === 0 && (await a4.getByLabel("Your name").inputValue()) === "Ann Four");
    await goList(a4);
    ok("the list does not claim an attempt is in progress", (await card(a4, "Replace me").innerText()).includes("Not attempted yet"));

    await admin.getByRole("button", { name: "← All tests" }).click();
    await admin.getByRole("button", { name: "Attempts", exact: true }).click();
    await admin.waitForFunction(() => !document.body.innerText.includes("Ann Four"), null, { timeout: 12000 });
    ok("the admin's Attempts tab has no leftover row for the discarded attempt", true);
    ok("Ann Three has exactly one attempt (the new one)", (await admin.locator("tbody tr", { hasText: "Ann Three" }).count()) === 1);
  });

  await group("deleting a test warns with the CURRENT numbers, and Cancel keeps everything", async () => {
    const id = await mkTest("Counted", 2);
    await admin.goto(`${BASE}/test/admin`);
    await row("Counted").waitFor();
    ok("the table (loaded before the attempt) shows 0 attempts", (await row("Counted").innerText()).replace(/\s+/g, " ").includes("2 50% 0 Open"));
    const token = (await api("POST", "/session")).data.token;
    await api("POST", "/attempt/start", { token, body: { name: "Late Bird", testId: id } }); // after the table was loaded
    admin.dialogAction = "dismiss";
    admin.dialogMessages.length = 0;
    await row("Counted").getByRole("button", { name: "Delete" }).click();
    await admin.waitForFunction(() => true);
    ok("the warning shows the real numbers: 2 questions and 1 attempt", admin.dialogMessages.length === 1 && admin.dialogMessages[0].includes("2 question(s) and 1 attempt(s)"), JSON.stringify(admin.dialogMessages));
    ok("Cancel keeps the test and its attempt", (await row("Counted").count()) === 1 && (await withDb((db) => db.collection("attempts").countDocuments({ testTitle: "Counted" }))) === 1);
    admin.dialogAction = "accept";
    await row("Counted").getByRole("button", { name: "Delete" }).click();
    await row("Counted").waitFor({ state: "detached" });
    ok("OK deletes the test together with its attempt", (await withDb((db) => db.collection("attempts").countDocuments({ testTitle: "Counted" }))) === 0);

    // Cancelling the other destructive actions
    const keep = await mkTest("Keep me", 2);
    await admin.reload();
    await row("Keep me").getByRole("button", { name: "Edit" }).click();
    await admin.getByRole("heading", { name: "Test details" }).waitFor();
    admin.dialogAction = "dismiss";
    await admin.locator("div.bg-white.rounded.shadow.p-3.text-sm").first().getByRole("button", { name: "Delete" }).click();
    await admin.waitForTimeout(500);
    ok("cancelling 'delete question' keeps the question", (await admin.getByText("2 question(s)").count()) >= 1);
    await admin.getByRole("button", { name: "Import from JSON" }).click();
    await admin.getByPlaceholder("Paste questions JSON here").fill(JSON.stringify(simpleQuestions(1, "Nope-")));
    await admin.getByRole("button", { name: "Replace all" }).click();
    await admin.waitForTimeout(500);
    ok("cancelling 'Replace all' keeps the old questions", (await withDb((db) => db.collection("questions").countDocuments({ testId: keep }))) === 2);
    admin.dialogAction = "accept";
  });

  await group("what the admin types is shown literally, and long titles fit a phone", async () => {
    const tricky = '<b>Bold</b> & "quotes" <script>window.__xss = 1</script>';
    await mkTest(tricky, 2, { description: "line one\nline two" });
    const longTitle = "Supercalifragilisticexpialidocious".repeat(4).slice(0, 120);
    const longId = await mkTest(longTitle, 2, { description: "d".repeat(300) });
    await mkTest("Twin", 2);
    await mkTest("Twin", 2);

    const phone = await mk("phone", 375);
    await goList(phone);
    const trickyCard = phone.locator("article", { has: phone.locator("h2", { hasText: "<b>Bold</b>" }) });
    ok("HTML in a title is shown as text, not run", (await trickyCard.count()) === 1 && (await phone.locator("article h2 b").count()) === 0 && (await phone.evaluate(() => window.__xss)) === undefined);
    ok("a line break in a description is kept", /line one\s*\n\s*line two/.test(await trickyCard.innerText()));
    ok("two tests with the same title are both listed with different links", (await phone.locator("article h2", { hasText: /^Twin$/ }).count()) === 2 && new Set(await phone.locator("article:has(h2:text-is('Twin')) a").evaluateAll((els) => els.map((e) => e.getAttribute("href")))).size === 2);
    ok("the list fits a 375px phone with a 120-character title and a 300-character description", (await overflow(phone)) <= 1, await overflow(phone));
    await phone.goto(`${BASE}/test/${longId}`);
    await phone.getByRole("button", { name: "Start Test" }).waitFor();
    ok("the start screen fits too", (await overflow(phone)) <= 1, await overflow(phone));
    await startAs(phone, "Pho Ne");
    await phone.locator("fieldset").first().waitFor();
    ok("and so does the running test (sticky header with the long title)", (await overflow(phone)) <= 1, await overflow(phone));

    const adminPhone = await mk("adminPhone", 375);
    await loginOn(adminPhone);
    ok("the admin Tests tab fits a phone", (await overflow(adminPhone)) <= 1, await overflow(adminPhone));
    await adminPhone.locator("tbody p.font-semibold", { hasText: "<b>Bold</b>" }).first().waitFor();
    ok("the admin table shows the HTML title as text", (await adminPhone.locator("tbody p.font-semibold", { hasText: "<b>Bold</b>" }).count()) === 1 && (await adminPhone.locator("tbody p.font-semibold b").count()) === 0);
    await adminPhone.getByRole("button", { name: "Attempts", exact: true }).click();
    await adminPhone.locator("#attempts-filter").waitFor();
    ok("the Attempts tab (with a 120-character test in the filter) fits a phone", (await overflow(adminPhone)) <= 1, await overflow(adminPhone));
    await adminPhone.getByRole("button", { name: "Tests", exact: true }).click();
    await adminPhone.locator("tbody tr", { has: adminPhone.locator("p.font-semibold", { hasText: "Supercali" }) }).getByRole("button", { name: "Edit" }).click();
    await adminPhone.getByRole("heading", { name: "Test details" }).waitFor();
    ok("the test editor fits a phone", (await overflow(adminPhone)) <= 1, await overflow(adminPhone));
  });

  await group("leaving a running test through the site and coming back", async () => {
    const id = await mkTest("Come back", 3);
    const nav = await mk("nav2");
    await nav.goto(`${BASE}/test/${id}`);
    await startAs(nav, "Nina Nav");
    await nav.locator("fieldset").first().waitFor();
    await nav.locator("fieldset").first().locator('input[type="radio"]').nth(1).check();
    await nav.getByText("Answered 1 / 3").waitFor();
    await nav.locator("nav a", { hasText: "MCQ Test" }).first().click();
    await nav.getByRole("heading", { name: "Tests", exact: true }).waitFor();
    ok("the navbar leaves the test without a pop-up and the list shows it in progress", (await card(nav, "Come back").innerText()).includes("In progress"));
    await card(nav, "Come back").getByRole("link", { name: "Resume" }).click();
    await nav.getByText("Answered 1 / 3").waitFor();
    ok("Resume restores the saved answer", (await nav.locator("fieldset").count()) === 3);
    await nav.goBack();
    await nav.getByRole("heading", { name: "Tests", exact: true }).waitFor();
    await nav.goForward();
    await nav.getByText("Answered 1 / 3").waitFor();
    ok("the browser's Back and Forward buttons work around a running test", true);
  });

  await group("the agent's browser has problems: a bad session, blocked storage, no network", async () => {
    const junk = await mk("junk", 1200, () => { try { localStorage.setItem("callsopAgentToken", "garbage.token"); } catch { /* ignore */ } });
    await goList(junk);
    ok("a garbage session token is replaced silently and the list still loads", (await cardTitles(junk)).length >= 1);

    const blocked = await mk("blocked", 1200, () => Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }));
    await goList(blocked);
    await blocked.locator("article").first().getByRole("link").click();
    await blocked.getByRole("button", { name: "Start Test" }).waitFor();
    await startAs(blocked, "No Storage");
    await blocked.locator("fieldset").first().waitFor();
    ok("with storage blocked, the list opens and a test can still be started", (await blocked.locator("fieldset").count()) >= 2);

    // The list cannot be loaded, then can.
    const offline = await mk("offline");
    await offline.route("**/api/tests", (route) => route.abort());
    await offline.goto(`${BASE}/test`);
    await offline.getByRole("button", { name: "Try again" }).waitFor();
    ok("when the list cannot load, there is an error and no false 'no tests' message", (await offline.getByText("No tests are available right now.").count()) === 0);
    await offline.unroute("**/api/tests");
    await offline.route("**/api/tests", async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue(); });
    await offline.getByRole("button", { name: "Try again" }).click();
    await offline.getByText("Loading tests…").waitFor();
    ok("while retrying it says Loading (never 'no tests are available')", (await offline.getByText("No tests are available right now.").count()) === 0);
    await offline.locator("article").first().waitFor({ timeout: 10000 });
    ok("a retry brings the tests back", true);

    // Submit fails (network), then works.
    const id = await mkTest("Flaky net", 3);
    const flaky = await mk("flaky");
    await flaky.goto(`${BASE}/test/${id}`);
    await startAs(flaky, "Fay Net");
    await flaky.locator("fieldset").first().waitFor();
    await flaky.route("**/submit", (route) => route.abort());
    await flaky.getByRole("button", { name: "Submit Test" }).click();
    await flaky.getByRole("button", { name: "Yes, submit" }).click();
    const alert = flaky.getByRole("alert");
    await alert.waitFor();
    const box = await alert.boundingBox();
    ok("a failed submit shows its error next to the Submit button, on screen", box && box.y >= 0 && box.y + box.height <= 900, JSON.stringify(box));
    ok("the test is still there to submit again", (await flaky.locator("fieldset").count()) === 3);
    await flaky.unroute("**/submit");
    await flaky.getByRole("button", { name: "Submit Test" }).click();
    await flaky.getByRole("button", { name: "Yes, submit" }).click();
    await flaky.getByRole("heading", { name: "Your Result" }).waitFor();
    ok("submitting again works once the network is back", true);
  });

  await group("keyboard and double clicks", async () => {
    const id = await mkTest("Keys", 3);
    const key = await mk("key");
    await key.goto(`${BASE}/test/${id}`);
    await key.getByLabel("Your name").focus();
    await key.keyboard.type("Kay Board");
    await key.keyboard.press("Enter");
    await key.locator("fieldset").first().waitFor();
    ok("the name form is submitted with Enter", true);
    const groupNames = await key.getByRole("group").evaluateAll((els) => els.map((e) => e.getAttribute("aria-labelledby")));
    ok("each question is a named group (the question text labels it)", (await key.getByRole("group", { name: /^\d+\. Keys-\d: pick B$/ }).count()) === 3 && (await key.getByRole("group").count()) === 3, `${await key.getByRole("group").count()} groups: ${JSON.stringify(groupNames)}`);
    await key.getByRole("button", { name: "Submit Test" }).focus();
    await key.keyboard.press("Enter");
    await key.getByRole("dialog").waitFor();
    ok("the submit box puts focus on the safe choice 'Go back'", (await key.evaluate(() => document.activeElement?.textContent?.trim())) === "Go back");
    await key.keyboard.press("Escape");
    await key.getByRole("dialog").waitFor({ state: "detached" });
    ok("Escape closes it and the test carries on", (await key.locator("fieldset").count()) === 3);

    const twice = await mk("twice");
    await twice.goto(`${BASE}/test/${id}`);
    await twice.getByLabel("Your name").fill("Dee Click");
    await twice.getByRole("button", { name: "Start Test" }).dblclick();
    await twice.locator("fieldset").first().waitFor();
    await twice.waitForTimeout(800);
    const count = await withDb((db) => db.collection("attempts").countDocuments({ testId: id, name: "Dee Click" }));
    ok("a double click on Start creates ONE attempt", count === 1, count);

    // Answers cannot be changed while the submit is on its way.
    await twice.getByRole("button", { name: "Submit Test" }).click();
    await twice.route("**/submit", async (route) => { await new Promise((resolve) => setTimeout(resolve, 1200)); await route.continue(); });
    await twice.getByRole("button", { name: "Yes, submit" }).click();
    await twice.locator("fieldset").first().locator('input[type="radio"]').first().waitFor();
    ok("the options are disabled while submitting", await twice.locator("fieldset").first().locator('input[type="radio"]').first().isDisabled());
    await twice.getByRole("heading", { name: "Your Result" }).waitFor({ timeout: 10000 });
  });

  await group("question editing inside a second test leaves the other test alone", async () => {
    const other = await mkTest("Bystander", 2);
    const target = await mkTest("Editable", 3);
    await admin.goto(`${BASE}/test/admin`);
    await row("Editable").getByRole("button", { name: "Edit" }).click();
    await admin.getByRole("heading", { name: "Test details" }).waitFor();
    const cards = admin.locator("div.bg-white.rounded.shadow.p-3.text-sm");
    ok("the first question cannot move up, the last cannot move down", (await cards.first().getByRole("button", { name: "Move up" }).isDisabled()) && (await cards.last().getByRole("button", { name: "Move down" }).isDisabled()));
    await cards.first().getByRole("button", { name: "Move down" }).click();
    await admin.waitForFunction(() => document.querySelectorAll("div.bg-white.rounded.shadow.p-3.text-sm")[1].innerText.includes("Edit-1"));
    ok("Move down swaps the first two questions", true);

    await admin.getByRole("button", { name: "Import from JSON" }).click();
    await admin.locator('input[type="file"]').setInputFiles({ name: "q.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ questions: simpleQuestions(4, "File-") })) });
    await admin.waitForFunction(() => document.querySelector("textarea[placeholder='Paste questions JSON here']").value.includes("File-1"));
    await admin.getByRole("button", { name: "Replace all" }).click();
    await admin.getByText("Imported 4 question(s).").waitFor({ timeout: 15000 });
    ok("a JSON file can be imported", (await cards.count()) === 4);
    ok("Replace all changed only this test (the other still has 2 questions)", (await withDb((db) => db.collection("questions").countDocuments({ testId: other }))) === 2 && (await withDb((db) => db.collection("questions").countDocuments({ testId: target }))) === 4);
  });

  await group("editing a test's details shows to agents at once", async () => {
    const id = await mkTest("Editable details", 2);
    await admin.goto(`${BASE}/test/admin`);
    await row("Editable details").getByRole("button", { name: "Edit" }).click();
    await admin.getByRole("heading", { name: "Test details" }).waitFor();
    await admin.getByLabel("Description (shown to agents, optional)").fill("Now with a description.");
    await admin.getByLabel("Pass mark (%)").fill("90");
    await admin.getByRole("button", { name: "Save details" }).click();
    await admin.getByText("Saved.").waitFor();
    const viewer = await mk("viewer");
    await goList(viewer);
    const text = await card(viewer, "Editable details").innerText();
    ok("the agents' list shows the new description and pass mark", text.includes("Now with a description.") && text.includes("pass mark 90%"), text);
    await viewer.goto(`${BASE}/test/${id}`);
    await viewer.getByRole("button", { name: "Start Test" }).waitFor();
    ok("so does the start screen", (await viewer.getByText("2 multiple-choice questions. Pass mark: 90%.").count()) === 1);
  });

  await group("a page that cannot be downloaded after an update shows how to recover", async () => {
    const stale = await mk("stale");
    await stale.route("**/assets/McqList*.js", (route) => route.abort());
    await stale.goto(`${BASE}/`);
    await stale.locator("nav a", { hasText: "MCQ Test" }).first().click();
    await stale.getByRole("heading", { name: "This page could not be loaded" }).waitFor({ timeout: 15000 });
    ok("instead of a blank page there is a message with a Reload button", (await stale.getByRole("button", { name: "Reload" }).count()) === 1);
    await stale.unroute("**/assets/McqList*.js");
    await stale.getByRole("button", { name: "Reload" }).click();
    await stale.getByRole("heading", { name: "Tests", exact: true }).waitFor();
    ok("Reload brings the page back", true);
  });

  ok("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await finish(browser);
})().catch((e) => { console.error("E2E CRASHED", e); process.exit(2); });
