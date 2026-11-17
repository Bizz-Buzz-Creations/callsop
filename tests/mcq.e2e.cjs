// MCQ test + admin panel, end to end in real browsers. See tests/README.md.
const path = require("path");
const os = require("os");
const { BASE, bank, createRunner, launch, reset, seedAdmin, requireTestApi, displayOrder, answerBank } = require("./lib.cjs");

const { ok, group, finish } = createRunner();
const OUT = os.tmpdir();
const key = bank.map((q) => "ABCD".indexOf(q.answer));

(async () => {
  await reset();
  await seedAdmin("boss@example.com", "correct-horse-1");
  await requireTestApi("boss@example.com", "correct-horse-1");

  const browser = await launch();
  const errors = [];
  const mk = async (label) => {
    const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
    page.on("pageerror", (e) => errors.push(`${label}: ${e}`));
    page.on("dialog", (d) => d.accept());
    return page;
  };
  const admin = await mk("admin");
  const agent = await mk("agent");
  const TITLE = "Call Disposition Assessment";
  let order; // bank index of each question, in the order currently shown

  await group("admin login", async () => {
    await admin.goto(`${BASE}/test/admin`);
    await admin.getByLabel("Username").waitFor();
    ok("login form shown to visitors", true);
    ok("no admin data visible before login", (await admin.locator("table").count()) === 0);

    await admin.getByLabel("Username").fill("boss@example.com");
    await admin.getByLabel("Password").fill("wrong-password");
    await admin.getByRole("button", { name: "Log in" }).click();
    await admin.getByText("Incorrect email or password.").waitFor();
    ok("wrong password rejected", true);

    await admin.getByLabel("Username").fill("staff@example.com");
    await admin.getByLabel("Password").fill("staff-pass-123");
    await admin.getByRole("button", { name: "Log in" }).click();
    await admin.getByText("Incorrect email or password.").waitFor();
    ok("unknown account refused with the same message", true);

    await admin.getByLabel("Username").fill("boss@example.com");
    await admin.getByLabel("Password").fill("correct-horse-1");
    await admin.getByRole("button", { name: "Log in" }).click();
    await admin.getByRole("heading", { name: "Test Admin Panel" }).waitFor();
    ok("real admin gets the panel", true);
  });

  await group("admin creates a test and its questions", async () => {
    await admin.getByText("No tests yet.").waitFor();
    ok("the Tests tab starts empty", true);
    await admin.getByRole("button", { name: "New test" }).click();
    await admin.getByLabel("Title").fill(TITLE);
    await admin.getByLabel("Description (optional)").fill("Practise choosing the right disposition.");
    await admin.getByLabel("Pass mark (%)").fill("70");
    await admin.getByRole("button", { name: "Create test" }).click();
    await admin.getByRole("heading", { name: "Test details" }).waitFor();
    ok("creating a test opens its editor straight away", (await admin.getByLabel("Title").inputValue()) === TITLE);
    await admin.getByText("No questions in this test yet").waitFor();
    await admin.getByRole("button", { name: "Load built-in 30 questions" }).click();
    await admin.getByRole("button", { name: "Replace all" }).click();
    await admin.getByText("Imported 30 question(s).").waitFor({ timeout: 15000 });
    ok("built-in questions imported (30)", (await admin.locator("div.bg-white.rounded.shadow.p-3.text-sm").count()) === 30);
    const firstText = await admin.locator("div.bg-white.rounded.shadow.p-3.text-sm p.font-medium").first().innerText();
    ok("first question + correct answer shown", firstText.includes("automated voice message") && (await admin.locator("li.text-green-600").count()) === 30);

    await admin.getByRole("button", { name: "Import from JSON" }).click();
    await admin.getByPlaceholder("Paste questions JSON here").fill('{"questions":[{"question":"x","options":["only one"],"answer":"Z"}]}');
    await admin.getByRole("button", { name: "Append to existing" }).click();
    await admin.getByText("Question 1:", { exact: false }).waitFor();
    ok("invalid JSON import rejected with reasons", (await admin.getByText("needs 2 to 6 options").count()) > 0);
    await admin.getByPlaceholder("Paste questions JSON here").fill('[{"section":"Extra","question":"Imported question?","options":["Yes","No"],"answer":"B"}]');
    await admin.getByRole("button", { name: "Append to existing" }).click();
    await admin.getByText("Imported 1 question(s).").waitFor({ timeout: 15000 });
    await admin.getByText("31 question(s)").first().waitFor({ timeout: 15000 });
    ok("valid JSON appended (31)", true);

    await admin.getByRole("button", { name: "Add question" }).click();
    await admin.getByPlaceholder("Section (optional)").fill("Extra");
    await admin.getByPlaceholder("Question text").fill("Form-made question?");
    const opts = admin.locator("form input.flex-1");
    for (let i = 0; i < 4; i++) await opts.nth(i).fill(`Opt ${"ABCD"[i]}`);
    await admin.getByLabel("Option C is correct").check();
    await admin.getByRole("button", { name: "Save", exact: true }).click();
    await admin.getByText("32 question(s)").first().waitFor({ timeout: 15000 });
    ok("question added via form (32)", true);

    const cards = admin.locator("div.bg-white.rounded.shadow.p-3.text-sm");
    await cards.nth(31).getByRole("button", { name: "Edit" }).click();
    await admin.getByLabel("Option D is correct").check();
    await admin.getByRole("button", { name: "Save", exact: true }).click();
    await admin.getByText("Question updated.").waitFor();
    ok("question edited", (await cards.nth(31).locator("li.text-green-600").innerText()).startsWith("D."));

    await cards.nth(31).getByRole("button", { name: "Move up" }).click();
    await admin.waitForFunction(() => document.querySelectorAll("div.bg-white.rounded.shadow.p-3.text-sm")[30].innerText.includes("Form-made"));
    ok("question moved up", true);

    for (let i = 0; i < 2; i++) {
      await cards.nth(30).getByRole("button", { name: "Delete" }).click();
      await admin.waitForTimeout(700);
    }
    await admin.getByText("30 question(s)").first().waitFor({ timeout: 15000 });
    ok("extras deleted (back to 30)", true);
    await admin.screenshot({ path: path.join(OUT, "mcq-admin-questions.png") });
  });

  await group("admin test details", async () => {
    await admin.getByLabel("Pass mark (%)").fill("70");
    await admin.getByRole("button", { name: "Save details" }).click();
    await admin.getByText("Saved.").waitFor();
    ok("details saved", true);
    await admin.getByLabel("Pass mark (%)").fill("0");
    await admin.getByRole("button", { name: "Save details" }).click();
    await admin.waitForTimeout(600);
    ok("invalid pass mark (0) blocked, nothing saved", (await admin.getByText("Saved.").count()) === 0);
    await admin.getByLabel("Pass mark (%)").fill("70");
    await admin.getByRole("button", { name: "Save details" }).click();
    await admin.getByText("Saved.").waitFor();
    await admin.waitForTimeout(800);
    ok("form keeps its message/values after the save is reloaded", (await admin.getByText("Saved.").count()) === 1 && (await admin.getByLabel("Pass mark (%)").inputValue()) === "70");
    await admin.getByRole("button", { name: "← All tests" }).click();
    await admin.getByRole("button", { name: "Attempts", exact: true }).click();
    await admin.getByText("No attempts yet.").waitFor();
  });

  await group("agent takes the test", async () => {
    await agent.goto(`${BASE}/test`);
    await agent.getByRole("heading", { name: "Tests", exact: true }).waitFor();
    const card = agent.getByRole("article", { name: TITLE });
    await card.waitFor();
    ok("the test list shows the test with its description, size and pass mark", (await card.innerText()).includes("Practise choosing") && (await card.innerText()).includes("30 questions") && (await card.innerText()).includes("pass mark 70%"));
    ok("it is marked 'Not attempted yet'", (await card.getByText("Not attempted yet").count()) === 1);
    await card.getByRole("link", { name: "Start test" }).click();
    await agent.getByRole("button", { name: "Start Test" }).waitFor();
    ok("agent sees start screen with the admin's settings", (await agent.getByText("30 multiple-choice questions. Pass mark: 70%.").count()) === 1);
    ok("start screen asks for a name only (no employee ID)", (await agent.getByLabel("Your name").count()) === 1 && (await agent.locator("input").count()) === 1);
    ok("Start is disabled until a name is typed", await agent.getByRole("button", { name: "Start Test" }).isDisabled());
    await agent.getByLabel("Your name").fill("   ");
    ok("spaces alone do not count as a name", await agent.getByRole("button", { name: "Start Test" }).isDisabled());
    await agent.getByLabel("Your name").fill("Alice Agent");
    ok("typing a name enables Start", await agent.getByRole("button", { name: "Start Test" }).isEnabled());
    await agent.getByRole("button", { name: "Start Test" }).click();
    await agent.locator("fieldset").first().waitFor();
    ok("test shows 30 questions", (await agent.locator("fieldset").count()) === 30);
    order = await displayOrder(agent);
    for (let i = 0; i < 10; i++) await answerBank(agent, order, i, key[i]);
    ok("progress shows 10 answered", (await agent.getByText("Answered 10 / 30").count()) === 1);
  });

  await group("proctoring alerts reach the admin", async () => {
    const leave = () => agent.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("blur"));
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    });
    await leave();
    await agent.getByText("you left the test window").waitFor();
    ok("agent sees the warning banner and the test continues", (await agent.locator("fieldset").count()) === 30);
    await admin.getByText(`Alice Agent (Attempt #1, ${TITLE})`).first().waitFor({ timeout: 10000 });
    ok("admin got an alert naming the agent, attempt and test", (await admin.getByText("Switched tab or minimised the window").count()) >= 1);
    await agent.waitForTimeout(1200);
    await agent.evaluate(() => window.dispatchEvent(new Event("blur")));
    await admin.getByText("Opened another window or application").first().waitFor({ timeout: 10000 });
    ok("second alert (other application) reaches admin", true);
    await admin.screenshot({ path: path.join(OUT, "mcq-admin-alerts.png") });
  });

  await group("resume after reload, scoring, review", async () => {
    await agent.reload();
    await agent.locator("fieldset").first().waitFor();
    ok("reload resumes the same attempt (30 questions)", (await agent.locator("fieldset").count()) === 30);
    ok("previous 10 answers restored", (await agent.getByText("Answered 10 / 30").count()) === 1);
    order = await displayOrder(agent);
    let restored = true;
    for (let i = 0; i < 10; i++) restored = restored && (await agent.locator("fieldset").nth(order.indexOf(i)).locator("input:checked").evaluate((el, letter) => el.closest("label").innerText.trim().startsWith(letter + "."), "ABCD"[key[i]]));
    ok("each restored answer is still on the right question (despite the new order)", restored);

    // Questions reshuffle on every refresh
    const orders = [order];
    for (let k = 0; k < 3; k++) {
      await agent.reload();
      await agent.locator("fieldset").first().waitFor();
      orders.push(await displayOrder(agent));
    }
    ok("every load shows all 30 questions exactly once", orders.every((o) => o.length === 30 && new Set(o).size === 30 && !o.includes(-1)));
    ok("the order changes between refreshes (4 loads -> at least 3 different orders)", new Set(orders.map((o) => o.join(","))).size >= 3, orders.map((o) => o.slice(0, 5).join(",")).join(" | "));
    const numbers = await agent.locator("fieldset p.font-medium").allInnerTexts();
    ok("question numbers run 1..30 in the order shown", numbers.every((t, i) => t.startsWith(`${i + 1}.`)));
    ok("no section headings in the shuffled test", (await agent.locator("h2").count()) === 0);
    order = orders[orders.length - 1];
    ok("answers stay with their questions after every reshuffle", (await agent.getByText("Answered 10 / 30").count()) === 1);

    for (let i = 10; i < 30; i++) await answerBank(agent, order, i, i >= 27 ? (key[i] + 1) % 4 : key[i]);
    let nativeDialogs = 0;
    const countDialog = () => nativeDialogs++;
    agent.on("dialog", countDialog);
    await agent.getByRole("button", { name: "Submit Test" }).click();
    await agent.getByRole("dialog").waitFor();
    ok("submit asks in the page (no browser pop-up that steals focus)", nativeDialogs === 0);
    await agent.getByRole("button", { name: "Go back" }).click();
    ok("'Go back' closes the box and the test continues", (await agent.getByRole("dialog").count()) === 0 && (await agent.locator("fieldset").count()) === 30);
    await agent.getByRole("button", { name: "Submit Test" }).click();
    await agent.getByRole("button", { name: "Yes, submit" }).click();
    agent.off("dialog", countDialog);
    await agent.getByRole("heading", { name: "Your Result" }).waitFor({ timeout: 15000 });
    const headline = (await agent.locator("p.text-3xl").innerText()).replace(/\s+/g, " ");
    ok("server-scored result 27 / 30 (90%)", headline === "27 / 30 (90%)", headline);
    ok("Passed shown", (await agent.getByText("Passed · pass mark 70%").count()) === 1);
    ok("review: 27 correct / 3 incorrect", (await agent.getByText("Correct", { exact: true }).count()) === 27 && (await agent.getByText("Incorrect", { exact: true }).count()) === 3);
    ok("review shows correct answers", (await agent.getByText("(correct answer)").count()) === 30);
    await agent.screenshot({ path: path.join(OUT, "mcq-agent-result.png") });

    await admin.getByText("27 / 30 (90%)").first().waitFor({ timeout: 10000 });
    ok("admin sees the score", true);
    const row = (await admin.locator("tbody tr").first().innerText()).replace(/\s+/g, " ");
    ok("admin row: Alice Agent, the test, attempt #1, completed, 2 warnings", row.startsWith(`Alice Agent ${TITLE} #1 `) && row.includes("Completed") && / 2 /.test(row), row);
  });

  await group("details, retake and admin delete", async () => {
    await admin.getByRole("button", { name: "Details" }).click();
    const warnItems = await admin.locator("tbody ul li").allInnerTexts();
    ok("admin details list both warnings with times", warnItems.length === 2 && warnItems[0].includes("Switched tab") && warnItems[1].includes("Opened another"), JSON.stringify(warnItems));
    ok("answer chips: 3 red, 27 green", (await admin.locator("span.bg-red-600.text-xs").count()) === 3 && (await admin.locator("span.bg-green-600.text-xs").count()) === 27);
    await admin.screenshot({ path: path.join(OUT, "mcq-admin-attempts.png"), fullPage: true });

    await agent.getByRole("link", { name: "Back to all tests" }).click();
    const doneCard = agent.getByRole("article", { name: TITLE });
    await doneCard.waitFor();
    ok("back on the list the test shows the last result and 'Take again'", (await doneCard.innerText()).includes("Last result: 27/30 (90%)") && (await doneCard.innerText()).includes("Passed") && (await doneCard.getByRole("link", { name: "Take again" }).count()) === 1);
    await doneCard.getByRole("link", { name: "Take again" }).click();
    await agent.getByRole("button", { name: "Start Test" }).waitFor();
    ok("the name is remembered for a retake", (await agent.getByLabel("Your name").inputValue()) === "Alice Agent");
    await agent.getByRole("button", { name: "Start Test" }).click();
    await agent.locator("fieldset").first().waitFor({ timeout: 10000 });
    ok("the same browser can retake straight away (no limit)", (await agent.locator("fieldset").count()) === 30);
    await admin.getByText("In progress (0/30 answered)").waitFor({ timeout: 10000 });
    ok("admin sees test #2 appear under the same name", (await admin.locator("tbody tr").filter({ hasText: "Alice Agent" }).filter({ hasText: "#2" }).count()) === 1);

    await admin.locator("tbody tr", { hasText: "Completed" }).getByRole("button", { name: "Delete" }).click();
    await admin.getByText("1 attempt(s)").waitFor({ timeout: 10000 });
    ok("admin deleted the completed test #1", true);
  });

  ok("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await finish(browser);
})().catch((e) => { console.error("E2E CRASHED", e); process.exit(2); });
