// The whole app except the MCQ test: navigation, SOP wizard, report, rebuttals
// dialog and calculator. See tests/README.md.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { BASE, rebuttals, pitch, createRunner, launch } = require("./lib.cjs");

const { ok, group, finish } = createRunner();
const OUT = os.tmpdir();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const pageErrors = [], consoleErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/google|ERR_|Failed to load resource/i.test(m.text())) consoleErrors.push(m.text()); });
  let dialogAction = "accept";
  const dialogs = [];
  page.on("dialog", (d) => { dialogs.push(d.message()); dialogAction === "accept" ? d.accept() : d.dismiss(); });

  const goto = (p) => page.goto(BASE + p);
  const step = (label) => page.getByRole("button", { name: label, exact: true }).click();
  const badge = async () => { const l = page.locator("div.inline-block.rounded-full"); return (await l.count()) ? (await l.first().innerText()).trim() : null; };
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("sopFormData")));
  const credGroup = (label) => page.locator("div.mb-4.w-full").filter({ has: page.locator("label.block", { hasText: `${label}:` }) });
  const monthYear = (monthsAgo) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - monthsAgo); return d.toLocaleString("en-US", { month: "long", year: "numeric" }); };

  await group("navigation, 404 and static pages", async () => {
    await goto("/");
    await page.getByRole("heading", { name: "Standard Call Procedure" }).waitFor();
    ok("home renders SOP", (await page.getByRole("button", { name: "Debt Confirmation", exact: true }).count()) === 1);
    ok("navbar has 3 links", (await page.locator("nav a").count()) === 3);
    ok("home link is active", /bg-indigo-500/.test(await page.locator("nav a").nth(0).getAttribute("class")));
    await page.locator("nav a", { hasText: "Income & Expenditure Calculator" }).click();
    await page.getByText("Income Calculator").waitFor();
    ok("calculator route via navbar", page.url().endsWith("/calculator"));
    ok("calculator link active, home not", /bg-indigo-500/.test(await page.locator("nav a").nth(1).getAttribute("class")) && !/bg-indigo-500/.test(await page.locator("nav a").nth(0).getAttribute("class")));
    await page.locator("nav a", { hasText: "MCQ Test" }).click();
    await page.getByRole("heading", { name: "Tests", exact: true }).waitFor();
    ok("MCQ route via navbar", page.url().endsWith("/test"));
    await page.locator("nav a", { hasText: "Standard Call Procedure" }).click();
    await page.getByRole("heading", { name: "Standard Call Procedure" }).waitFor();
    ok("back to home via navbar", page.url() === BASE + "/");
    await goto("/does-not-exist");
    ok("unknown route shows 404", (await page.getByText("404 - Page Not Found").count()) === 1);
    for (const p of ["/fallback.html", "/access-denied.html"]) {
      const r = await page.request.get(BASE + p);
      ok(`${p} served (200, has content)`, r.status() === 200 && (await r.text()).length > 100);
    }
    ok("logo asset served", (await page.request.get(BASE + "/logo.png")).status() === 200);
  });

  await group("SOP step 0: payment badge logic", async () => {
    await goto("/");
    await page.evaluate(() => localStorage.clear());
    await goto("/");
    await page.getByText("Confirmations of debts:").waitFor();
    ok("fresh form shows NO badge (not 'Falling Behind')", (await badge()) === null, await badge());
    const pay = page.getByPlaceholder("Enter your payment amount");
    const cases = [["0", "Falling Behind"], ["0.5", "Token Payment"], ["1", "Token Payment"], ["10", "Token Payment"], ["10.5", "Low Payment"], ["11", "Low Payment"], ["150", "Low Payment"], ["150.5", "Normal Payment"], ["151", "Normal Payment"], ["300", "Normal Payment"], ["300.5", "High Payment"], ["301", "High Payment"], ["5000", "High Payment"], ["-5", null], ["", null]];
    for (const [value, want] of cases) {
      await pay.fill(value);
      const got = await badge();
      ok(`payment ${JSON.stringify(value)} -> ${want}`, got === want, `got ${got}`);
    }
    await pay.fill("5");
    ok("badge persisted into localStorage", (await stored()).debtConfirmation.badge === "Token Payment");
  });

  await group("SOP step 0: conversation branches", async () => {
    const pay = page.getByPlaceholder("Enter your payment amount");
    await pay.fill("0");
    await page.getByText("Payment Delay Details").waitFor();
    const since = page.getByPlaceholder("e.g. January 2024");
    await since.fill("January 2020");
    ok("old date: no 6-month questions", (await page.getByText("payment holiday or breathing period").count()) === 0);
    await since.fill(monthYear(2));
    await page.getByText("payment holiday or breathing period").waitFor();
    ok("recent date (2 months ago): breathing question appears", true);
    await since.fill(monthYear(8));
    ok("8 months ago: question hidden again", (await page.getByText("payment holiday or breathing period").count()) === 0);
    await since.fill(monthYear(1));
    await page.locator('input[name="breathingPeriod"][value="true"]').check();
    ok("breathing=yes -> credit-rating warning", (await page.getByText("it will ruin your credit rating").count()) === 1);
    await page.locator('input[name="breathingPeriod"][value="false"]').check();
    await page.getByText("have you ever been chased").waitFor();
    await page.locator('input[name="chasingCreditors"][value="true"]').check();
    ok("chased=yes -> legal protection text", (await page.getByText("legal protections against all of your").count()) === 1);
    await page.locator('input[name="chasingCreditors"][value="false"]').check();
    await page.getByText("So are you not making payment because").waitFor();
    await page.locator('input[name="affordingPayment"][value="one"]').check();
    ok("affording=one -> hoax warning, no closing 'process application'", (await page.getByText("could be a hoax").count()) === 1 && (await page.getByText("I’m going to process the application").count()) === 0);
    await page.locator('input[name="affordingPayment"][value="two"]').check();
    ok("affording=two -> text + closing paragraph", (await page.getByText("compromising with their basic necessities").count()) === 1 && (await page.getByText("I’m going to process the application").count()) === 1);
    await page.locator('input[name="affordingPayment"][value="three"]').check();
    ok("affording=three -> follow-up question", (await page.getByText("So let me just check what best we can do").count()) === 1);

    await pay.fill("5");
    await page.getByText("Token Payment Details").waitFor();
    await page.getByPlaceholder("e.g. January 2024").fill("March 2025");
    ok("token: since-date stored", (await stored()).debtConfirmation.delaySince === "March 2025");

    await pay.fill("400");
    await page.getByText("How do you find these payments?").waitFor();
    await page.locator('input[name="paymentStatus"][value="fine"]').check();
    ok("high/fine message", (await page.getByText("You're managing it well").count()) === 1);
    await page.locator('input[name="paymentStatus"][value="struggling"]').check();
    ok("high/struggling message", (await page.getByText("If you are struggling then our basic job").count()) === 1);
    await page.locator('input[name="interestNotice"][value="Yes"]').check();
    ok("high/interest yes", (await page.getByText("So these solution is going").count()) >= 1);
    await page.locator('input[name="interestNotice"][value="No"]').check();
    ok("high/interest no", (await page.getByText("You might have not noticed").count()) === 1);

    for (const amount of ["100", "200"]) {
      await pay.fill(amount);
      await page.getByText("Are you dealing with a debt management company").waitFor();
      ok(`payment ${amount}: debt-management question shown`, true);
    }
    await page.locator('input[name="handlingMethod"][value="company"]').check();
    await page.getByText("Which company is it").waitFor();
    await page.locator('input[name="companyType"][value="private"]').check();
    ok("company/private text", (await page.getByText("private DMP (Debt Management Plan)").count()) === 1);
    await page.locator('input[name="companyType"][value="charity"]').check();
    ok("company/charity text", (await page.getByText("StepChange or a similar charity DMP").count()) === 1);
    await page.locator('input[name="handlingMethod"][value="myself"]').check();
    ok("paying by myself text", (await page.getByText("the majority portion of your payments").count()) === 1);
  });

  await group("SOP step 0: creditor lists", async () => {
    await page.getByPlaceholder("Enter your payment amount").fill("5");
    const loan = credGroup("Loan");
    await loan.locator("button").nth(0).click();
    ok("plus adds a row", (await loan.getByPlaceholder("Amount").count()) === 1);
    ok("count box shows 1", (await loan.locator('input[min="0"]').inputValue()) === "1");
    await loan.locator("select").selectOption("Barclays");
    await loan.getByPlaceholder("Amount").fill("5000");
    await loan.getByPlaceholder("Payment").fill("3");
    await loan.locator("button").nth(0).click();
    await loan.locator("select").nth(1).selectOption("Other");
    ok("'Other' swaps select for a name box", (await loan.getByPlaceholder("Enter Creditor Name").count()) === 1);
    await loan.getByPlaceholder("Enter Creditor Name").fill("Local Lender");
    ok("2 rows now", (await loan.getByPlaceholder("Amount").count()) === 2);
    dialogAction = "dismiss";
    await loan.locator("button").nth(1).click();
    ok("minus + Cancel keeps the row", (await loan.getByPlaceholder("Amount").count()) === 2);
    dialogAction = "accept";
    await loan.locator("button").nth(1).click();
    ok("minus + OK removes the last row", (await loan.getByPlaceholder("Amount").count()) === 1);
    ok("confirmation dialog warned about data loss", dialogs.some((m) => m.includes("remove the input field")));
    await loan.locator('input[min="0"]').fill("3");
    ok("typing 3 in the count box makes 3 rows", (await loan.getByPlaceholder("Amount").count()) === 3);
    await loan.locator('input[min="0"]').fill("1");
    ok("typing 1 trims back to 1 row (kept Barclays data)", (await loan.getByPlaceholder("Amount").count()) === 1 && (await loan.getByPlaceholder("Amount").inputValue()) === "5000");

    const card = credGroup("Credit Card");
    await card.locator("button").nth(0).click();
    await card.locator("select").selectOption("Amazon");
    await card.getByPlaceholder("Amount").fill("300");
    await card.getByPlaceholder("Payment").fill("10");

    const gas = credGroup("Gas"), elec = credGroup("Electric");
    await gas.locator("button").nth(0).click();
    await gas.locator("select").selectOption("Other");
    await gas.getByPlaceholder("Enter Creditor Name").fill("X Gas");
    await gas.getByPlaceholder("Amount").fill("200");
    await gas.getByPlaceholder("Payment").fill("2");
    await elec.locator("button").nth(0).click();
    await elec.locator("select").selectOption("Other");
    await elec.getByPlaceholder("Enter Creditor Name").fill("E.ON");
    await elec.getByPlaceholder("Amount").fill("50");
    await elec.getByPlaceholder("Payment").fill("5");
    await gas.getByText("Current Year").click();
    await elec.getByText("Previous Year").click();
    const gasCurrent = await gas.locator('input[type="radio"][value="current"]').isChecked();
    const elecPrevious = await elec.locator('input[type="radio"][value="previous"]').isChecked();
    ok("Gas 'Current Year' stays checked after Electric row 0 is set (independent radio groups)", gasCurrent && elecPrevious, `gasCurrent=${gasCurrent} elecPrevious=${elecPrevious}`);

    const hmrc = credGroup("HMRC");
    await hmrc.locator("button").nth(0).click();
    ok("GD row uses a free-text name (no creditor dropdown)", (await hmrc.locator("select").count()) === 0);
    await hmrc.getByPlaceholder("Enter Creditor Name").fill("HMRC Debt");
    await hmrc.getByPlaceholder("Amount").fill("100");
    await hmrc.getByPlaceholder("Payment").fill("1");

    const s = await stored();
    ok("localStorage holds loan/creditCard/gas/hmrc", s.debtConfirmation.loan.length === 1 && s.debtConfirmation.creditCard[0].name === "Amazon" && s.debtConfirmation.gas[0].customName === "X Gas" && s.debtConfirmation.hmrc[0].name === "HMRC Debt");
    ok("gas arrear stored as current", s.debtConfirmation.gas[0].arrear === "current", s.debtConfirmation.gas[0].arrear);
  });

  await group("SOP wizard navigation", async () => {
    await page.getByPlaceholder("Enter your debt amount").fill("7000");
    ok("Previous disabled on step 1", await page.getByRole("button", { name: "Previous" }).isDisabled());
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByText("Currently are Renting a property").waitFor();
    ok("Next -> step 2 (rental + marital)", (await page.getByText("Marital Status:").count()) === 1);
    await step("Employment Info");
    await page.getByText("Employment Information:").waitFor();
    await step("User Details + Summary");
    await page.getByText("User Information").waitFor();
    ok("Next disabled on last step", await page.getByRole("button", { name: "Next" }).isDisabled());
    await page.getByRole("button", { name: "Previous" }).click();
    ok("Previous goes back to employment", (await page.getByText("Employment Information:").count()) === 1);
    await step("Debt Confirmation");
    ok("data kept when navigating back", (await page.getByPlaceholder("Enter your debt amount").inputValue()) === "7000");
  });

  await group("SOP steps 1-2: rental, marital, kids wiring", async () => {
    await step("Rental + Marital Info");
    await page.getByPlaceholder("Private Rent").fill("600");
    await page.getByPlaceholder("Total mortgage outstanding?").fill("100000");
    await page.locator("#married").check();
    await step("Employment Info");
    ok("no kids answered -> NO child-benefit rows", (await page.getByPlaceholder("Child Benefits").count()) === 0);
    await step("Rental + Marital Info");
    await page.locator("#yes").check();
    await page.locator('input[type="number"][min="1"]').fill("2");
    await page.getByPlaceholder("e.g. 5, 8").fill("5, 8");
    await step("Employment Info");
    ok("kids=yes -> 2 child-benefit rows IMMEDIATELY", (await page.getByPlaceholder("Child Benefits").count()) === 2);
    await step("Rental + Marital Info");
    await page.locator("#no").check();
    await step("Employment Info");
    ok("kids=no -> rows gone immediately", (await page.getByPlaceholder("Child Benefits").count()) === 0);
    await step("Rental + Marital Info");
    await page.locator("#yes").check();
    ok("kids fields still remembered", (await page.getByPlaceholder("e.g. 5, 8").inputValue()) === "5, 8");
    await step("Employment Info");
    await page.getByPlaceholder("Full-time (FT)").nth(0).fill("1800");
    await page.getByPlaceholder("Universal Credit (UC)").nth(1).fill("400");
    await page.getByPlaceholder("Child Benefits").nth(0).fill("50");
    const s = await stored();
    ok("employment values stored", s.employementInfo.individualFT === "1800" && s.employementInfo.partnerUC === "400" && s.employementInfo.individualCB === "50");
  });

  await group("SOP step 3: user details + report", async () => {
    await step("User Details + Summary");
    await page.getByPlaceholder("Customer Full Name").fill("Jane Doe");
    await page.getByPlaceholder("First line of your address").fill("1 High Street");
    await page.getByPlaceholder("Postcode").fill("AB1 2CD");
    await page.getByPlaceholder("Contact Number").fill("07123456789");
    await page.getByPlaceholder("Email Address").fill("jane@example.com");
    await page.getByPlaceholder("Date Of Birth").fill("01/01/1990");
    ok("no report before clicking generate", (await page.locator("pre").count()) === 0);
    await page.getByRole("button", { name: "Generate Report" }).click();
    const report = await page.locator("pre").textContent();
    const expected = [
      "Jane Doe", "1 High Street", "AB1 2CD", "07123456789", "jane@example.com", "01/01/1990", "",
      "DEBTS LEVEL",
      "£7000.00 - £5.00/month (Since March 2025)",
      "- Barclays – £5000.00 – £3.00/month",
      "- Amazon – £300.00 – £10.00/month",
      "- X Gas – £200.00 – £2.00/month (Current Year)",
      "- E.ON – £50.00 – £5.00/month (Previous Year)",
      "- HMRC Debt – £100.00 – £1.00/month",
      "",
      "RENTAL DETAILS",
      "- Mortgage – 100000",
      "- PrivateRent – £600.00/month",
      "",
      "MARITAL STATUS",
      "- Status – married",
      "- Kids – 2 (5, 8)",
      "",
      "INCOME",
      "",
      "Individual",
      "- FT – £1800.00/month",
      "- CB – £50.00/month",
      "",
      "Partner",
      "- UC – £400.00/month",
    ].join("\n");
    ok("report text is exactly right", report === expected, "\n--- got ---\n" + report + "\n--- want ---\n" + expected);
    await page.screenshot({ path: path.join(OUT, "app-report.png"), fullPage: true });

    await page.getByRole("button", { name: "Copy", exact: false }).first().click();
    await page.getByText("Copied!").waitFor();
    ok("Copy button -> 'Copied!'", true);
    ok("clipboard holds the report", (await page.evaluate(() => navigator.clipboard.readText())) === expected);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.locator("button:has(svg.lucide-download)").click()]);
    ok("download filename pattern", /^report-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.txt$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    ok("downloaded file content equals report", fs.readFileSync(await dl.path(), "utf8") === expected);
    await page.evaluate(() => navigator.clipboard.writeText("cleared"));
    const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export" }).click()]);
    ok("Export = copy + download", fs.readFileSync(await dl2.path(), "utf8") === expected && (await page.evaluate(() => navigator.clipboard.readText())) === expected);
  });

  await group("SOP persistence, reset and corrupted storage", async () => {
    await goto("/");
    await page.getByText("Confirmations of debts:").waitFor();
    ok("data survives a reload (debt 7000)", (await page.getByPlaceholder("Enter your debt amount").inputValue()) === "7000");
    ok("badge restored after reload", (await badge()) === "Token Payment");
    ok("creditor row restored after reload", (await credGroup("Loan").getByPlaceholder("Amount").inputValue()) === "5000");
    await page.locator('button[data-tooltip-content="Reset Data"]').click();
    ok("reset asked for confirmation", dialogs.some((m) => m.includes("lose the entire data")));
    ok("reset clears localStorage form", JSON.stringify(await stored()) === "{}");
    ok("reset clears the screen (debt empty, no badge)", (await page.getByPlaceholder("Enter your debt amount").inputValue()) === "" && (await badge()) === null);
    await page.getByPlaceholder("Enter your debt amount").fill("123");
    dialogAction = "dismiss";
    await page.locator('button[data-tooltip-content="Reset Data"]').click();
    dialogAction = "accept";
    ok("reset + Cancel keeps data", (await page.getByPlaceholder("Enter your debt amount").inputValue()) === "123");
    await page.locator('button[data-tooltip-content="Reset Data"]').click();
    await step("User Details + Summary");
    await page.getByRole("button", { name: "Generate Report" }).click();
    ok("empty form still yields a report skeleton", (await page.locator("pre").textContent()).includes("DEBTS LEVEL"));

    for (const bad of ["null", "[1,2]", "\"text\"", "42", "{not json"]) {
      pageErrors.length = 0;
      await page.evaluate((v) => localStorage.setItem("sopFormData", v), bad);
      await goto("/");
      let alive = true;
      try { await page.getByText("Confirmations of debts:").waitFor({ timeout: 4000 }); } catch { alive = false; }
      ok(`corrupted storage ${bad} does not crash the app`, alive, `url=${page.url()} errors=${pageErrors[0] || ""}`);
    }
    await page.evaluate(() => localStorage.clear());
  });

  await group("rebuttals / pitch dialog", async () => {
    await goto("/");
    await page.locator("button.bg-yellow-600").click();
    await page.getByRole("heading", { name: "Rebuttals" }).waitFor();
    ok("dialog opens on Rebuttals tab", true);
    const rows = () => page.locator("button.w-full.flex");
    ok("virtualised list shows some rows (<47)", (await rows().count()) > 0 && (await rows().count()) < rebuttals.length);
    const search = page.getByPlaceholder("Search questions...");
    for (const term of ["who are you", "scam", "interest"]) {
      const want = rebuttals.filter((r) => r.question.toLowerCase().includes(term)).length;
      await search.fill(term);
      await page.waitForTimeout(500);
      const got = await rows().count();
      ok(`search "${term}" -> ${want} match(es)`, want > 6 ? got >= 1 : got === want, `got ${got}`);
    }
    await search.fill("zzzz-no-such-question");
    await page.waitForTimeout(500);
    ok("no results message", (await page.getByText("No matching questions found.").count()) === 1);
    await search.fill("who are you");
    await page.waitForTimeout(500);
    await rows().first().click();
    ok("clicking a row reveals the answer", (await page.getByText("We are a company specialized in providing solutions").count()) === 1);
    await rows().first().click();
    ok("clicking again collapses it", (await page.getByText("We are a company specialized in providing solutions").count()) === 0);
    await page.getByRole("button", { name: "Pitch", exact: true }).click();
    await page.getByRole("heading", { name: "Pitch" }).waitFor();
    ok(`pitch tab lists ${pitch.conversation.length} lines`, (await page.locator("span.block.text-xs.font-bold").count()) === pitch.conversation.length);
    ok("pitch shows Agent and Customer speakers", (await page.getByText("Agent", { exact: true }).count()) > 0 && (await page.getByText("Customer", { exact: true }).count()) > 0);
    await page.getByRole("button", { name: "Rebuttals", exact: true }).click();
    await page.getByRole("button", { name: "Add Rebuttal" }).click();
    await page.locator("iframe[src*='docs.google.com/forms']").waitFor({ state: "attached" });
    ok("Add Rebuttal opens the Google Form modal (iframe present)", true);
    await page.getByRole("button", { name: "Close" }).last().click();
    ok("form modal closes", (await page.locator("iframe").count()) === 0);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    ok("Escape closes the dialog", (await page.getByRole("heading", { name: "Rebuttals" }).count()) === 0);
    await page.locator("button.bg-yellow-600").click();
    await page.getByRole("button", { name: "Close" }).click();
    ok("Close button closes the dialog", (await page.getByRole("heading", { name: "Rebuttals" }).count()) === 0);
  });

  await group("income & expenditure calculator", async () => {
    await goto("/calculator");
    await page.getByText("Income Calculator").waitFor();
    const bar = page.locator("div.fixed.bottom-0");
    ok("totals start at £0.00", (await bar.innerText()).split("£0.00").length === 4);
    const inc = (n, v) => page.locator(`input[name="${n}"]`).fill(String(v));
    await inc("wages.salary", 2000); await inc("wages.partnerSalary", 500); await inc("benefits.universalCredit", 300);
    await inc("homeAndContents.rent", 800); await inc("foodAndHousekeeping.groceries", 400); await inc("utilities.electricity", 100);
    let t = await bar.innerText();
    ok("income total £2800.00", t.includes("£2800.00"), t);
    ok("expenditure total £1300.00", t.includes("£1300.00"), t);
    ok("balance £1500.00", t.includes("£1500.00"), t);
    await inc("wages.salary", 1500);
    t = await bar.innerText();
    ok("editing a field again updates totals (income £2300.00, balance £1000.00)", t.includes("£2300.00") && t.includes("£1000.00"), t);
    const cmpText = await page.locator("#comparison").first().innerText();
    ok("comparison lists the non-zero income/expense rows", ["Salary", "Partner Salary", "Universal Credit", "Rent", "Groceries", "Electricity"].every((x) => cmpText.includes(x)), cmpText.slice(0, 300));
    ok("comparison hides zero rows", !cmpText.includes("Carers Allowance") && !cmpText.includes("Hairdressing"));
    ok("comparison totals", cmpText.includes("Total Income: £2300.00") && cmpText.includes("Total Expenses: £1300.00") && cmpText.includes("Total Balance: £1000.00"), cmpText.slice(-200));
    await page.getByPlaceholder("Enter first name").fill("Jane");
    await page.getByPlaceholder("Enter last name").fill("Doe");
    await page.getByRole("button", { name: "Generate Report" }).click();
    await page.getByText("Download as PDF").waitFor();
    const rep = await page.locator("#comparison").nth(1).innerText();
    ok("report includes user details", rep.includes("Jane") && rep.includes("Doe"), rep.slice(0, 200));
    ok("report income total 2300.00", rep.includes("2300.00"));
    // KNOWN, pre-existing: the PDF's outgoings omit 25 of the 65 expense fields (e.g. electricity).
    const outgoings = rep.match(/Total outgoings\s*([\d.]+)/i)?.[1];
    console.log(`  NOTE  KNOWN ISSUE (not fixed): PDF 'Total outgoings' = ${outgoings}, calculator total = 1300.00`);
    await page.screenshot({ path: path.join(OUT, "app-calc.png"), fullPage: true });
    const [pdf] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), page.getByRole("button", { name: "Download as PDF" }).click()]);
    const pdfPath = await pdf.path();
    const head = fs.readFileSync(pdfPath).subarray(0, 5).toString();
    ok("PDF downloads as report.pdf", pdf.suggestedFilename() === "report.pdf");
    ok("PDF is a real PDF with content", head === "%PDF-" && fs.statSync(pdfPath).size > 5000, `${head} ${fs.statSync(pdfPath).size}`);
  });

  await group("console / page errors across the whole run", async () => {
    ok("no uncaught page errors", pageErrors.length === 0, pageErrors.join(" | "));
    ok("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  });

  await finish(browser);
})().catch((e) => { console.error("E2E CRASHED", e); process.exit(2); });
