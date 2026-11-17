// Admin panel -> Access tab (IP allowlist), in a real browser. See tests/README.md.
const path = require("path");
const os = require("os");
const { BASE, createRunner, launch, reset, seedAdmin, requireTestApi } = require("./lib.cjs");

const { ok, group, finish } = createRunner();

(async () => {
  await reset();
  await seedAdmin("boss", "correct-horse-1");
  await requireTestApi("boss", "correct-horse-1");

  const browser = await launch();
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("dialog", (d) => d.accept());

  const row = (value) => page.locator("tbody tr", { hasText: value });
  const msg = async (text) => page.getByText(text, { exact: false }).first().waitFor({ timeout: 10000 });

  await group("open the Access tab", async () => {
    await page.goto(`${BASE}/test/admin`);
    await page.getByLabel("Username").fill("boss");
    await page.getByLabel("Password").fill("correct-horse-1");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("button", { name: "Access", exact: true }).click();
    await page.getByText("IP filter:").waitFor();
    ok("the filter starts OFF", (await page.getByText("OFF", { exact: true }).count()) === 1 && (await page.getByRole("button", { name: "Turn on" }).count()) === 1);
    ok("warns that the edge secret is missing (filter not active yet)", (await page.getByText("Not active yet").count()) === 1);
    ok("the 6 default IPs are already in the list (added by default)", (await page.locator("tbody tr").count()) === 6 && (await row("14.96.246.106").count()) === 1 && (await row("192.168.0.0/16").count()) === 1 && (await page.locator("tbody tr", { hasText: "by default" }).count()) === 6);
    ok("shows my current IP, not in the list", (await page.getByTestId("my-ip").innerText()).length > 0 && (await page.getByText("not in the list").count()) === 1);
    const builtIn = await page.locator("span.font-mono.text-xs").allInnerTexts();
    ok("lists the 9 built-in always-allowed IPs", builtIn.length === 9 && builtIn.includes("103.217.245.94") && builtIn.includes("111.235.67.0/24") && builtIn.includes("171.78.155.25"), JSON.stringify(builtIn));
  });

  let myIp;
  await group("cannot lock yourself out", async () => {
    myIp = await page.getByTestId("my-ip").innerText();
    await page.getByRole("button", { name: "Turn on" }).click();
    await msg("is not allowed yet");
    ok("turning ON is refused while my IP is not in the list", (await page.getByText("OFF", { exact: true }).count()) === 1);
    ok("the message tells me why (it would lock me out)", (await page.getByText("lock you out").count()) === 1);

    await page.getByRole("button", { name: "Add my IP" }).click();
    await msg(`Added ${myIp}`);
    ok("'Add my IP' puts my IP in the list", (await row(myIp).count()) === 1);
    ok("it now says allowed and the button is gone", (await page.getByText("(allowed)").count()) === 1 && (await page.getByRole("button", { name: "Add my IP" }).count()) === 0);

    await page.getByRole("button", { name: "Turn on" }).click();
    await msg("IP filter is now ON");
    ok("the filter turns ON", (await page.getByText("ON", { exact: true }).count()) === 1 && (await page.getByRole("button", { name: "Turn off" }).count()) === 1);

    await row(myIp).getByRole("button", { name: "Delete" }).click();
    await msg("lock you out");
    ok("deleting my own rule while ON is refused", (await row(myIp).count()) === 1);
  });

  await group("add, validate and remove IPs", async () => {
    const add = async (value, label = "", expiry) => {
      await page.getByLabel("IP address or range").fill(value);
      await page.getByLabel("Label").fill(label);
      if (expiry) await page.getByLabel("Expires").selectOption({ label: `Expires: ${expiry}` });
      await page.getByRole("button", { name: "Add", exact: true }).click();
    };
    await add("abc");
    await msg("not a valid IP");
    ok("a nonsense IP is refused", (await row("abc").count()) === 0);
    await add("10.0.0.0/4");
    await msg("far too wide");
    ok("a far-too-wide range is refused", true);
    await add("0.0.0.0/0");
    await msg("far too wide");
    ok("'allow everyone' is refused", (await row("0.0.0.0").count()) === 0);

    await add("203.0.113.7", "Ishika home", "1 hour");
    await msg("Added 203.0.113.7");
    ok("a valid IP with a label is listed", (await row("203.0.113.7").count()) === 1 && (await row("203.0.113.7").innerText()).includes("Ishika home"));
    ok("it shows who added it and a real expiry time (not 'Never')", (await row("203.0.113.7").innerText()).includes("by boss") && !(await row("203.0.113.7").innerText()).includes("Never"));
    ok("the form is cleared after adding", (await page.getByLabel("IP address or range").inputValue()) === "");

    await add("203.0.113.7");
    await msg("already in the list");
    ok("adding the same IP twice is refused", (await row("203.0.113.7").count()) === 1);

    await add("198.51.100.77/24", "Branch");
    await msg("Added 198.51.100.0/24");
    ok("a range is saved as its network (host bits cleared)", (await row("198.51.100.0/24").count()) === 1);
    await add("2001:DB8::1");
    await msg("Added 2001:db8");
    ok("IPv6 is accepted", (await page.locator("tbody tr", { hasText: "2001:db8" }).count()) === 1);

    await row("203.0.113.7").getByRole("button", { name: "Delete" }).click();
    await msg("Removed 203.0.113.7");
    ok("a rule can be removed", (await row("203.0.113.7").count()) === 0);
  });

  await group("state survives a reload; turning OFF frees my rule", async () => {
    await page.reload();
    await page.getByRole("button", { name: "Access", exact: true }).click();
    await page.getByText("IP filter:").waitFor();
    ok("still logged in and the filter is still ON after a reload", (await page.getByText("ON", { exact: true }).count()) === 1);
    ok("the list is still there", (await row(myIp).count()) === 1 && (await row("198.51.100.0/24").count()) === 1);
    await page.getByRole("button", { name: "Turn off" }).click();
    await msg("IP filter is now OFF");
    ok("turning OFF is always allowed", (await page.getByText("OFF", { exact: true }).count()) === 1);
    await row(myIp).getByRole("button", { name: "Delete" }).click();
    await msg(`Removed ${myIp}`);
    ok("with the filter OFF my own rule can be removed", (await row(myIp).count()) === 0);
    await page.screenshot({ path: path.join(os.tmpdir(), "access-tab.png"), fullPage: true });
  });

  await group("phone width", async () => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok("the Access tab fits a 375px phone (no sideways page scroll)", overflow <= 1, String(overflow));
  });

  ok("no uncaught page errors", errors.length === 0, errors.join(" | "));
  await finish(browser);
})().catch((e) => { console.error("E2E CRASHED", e); process.exit(2); });
