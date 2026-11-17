# CallSOP

Call-agent tools: the Standard Call Procedure, an Income & Expenditure calculator and a
proctored MCQ test with an admin panel.

## MCQ test

- **Agents** click **MCQ Test** in the navbar (`/test`) and see every test the admin has
  opened. Each card shows the size, pass mark and the agent's own status (not attempted, in
  progress, last result). They pick one, type their name (required) and press **Start Test**.
  No login. A test can also be opened directly at `/test/<id>`.
- **Admins** sign in at `/test/admin` (username + password). The **Tests** tab creates as many
  different tests as needed, each with its own title, description, pass mark, questions and
  open/closed switch; tests can be duplicated or deleted (with their attempts). The
  **Attempts** tab shows every attempt (filter by test) and live tab-switch warnings.
- A test with no questions, or a closed test, is not offered to agents. An agent can keep one
  running attempt per test and take several tests side by side.
- Upgrading from the single-test version is automatic: on the first request the existing
  questions and attempts move into one test (its title and pass mark are kept).

How it is secured (all enforced on the server, in `netlify/api/`):

- The **answer key never reaches an agent's browser**. The server scores the test when it is
  submitted and only then returns the correct answers for the review screen.
- Tests are created, scored and completed by the server. The browser can only save answers
  to its own running test and report warnings against it.
- Tab switches and clicks on another application are recorded with the **server's** clock and
  shown to admins as alerts (the panel checks every 3 seconds). The test itself keeps running.
- Admin passwords are stored hashed (scrypt). Login tokens are signed and expire after 8 hours.
  After 8 failed logins an email or IP is locked out for 15 minutes. All input is validated, so
  NoSQL-injection payloads are rejected.
- Site-wide IP access control is managed in the admin panel (see **IP access** below).

### One-time setup

1. **MongoDB Atlas** (use your existing cluster; this app uses its own database, `callsop`).
   - *Database Access → Add New Database User*: give it a strong password and the privilege
     `readWrite` on the **`callsop`** database only, so it cannot touch your other apps' data.
   - *Network Access*: Netlify Functions have no fixed IP address, so Atlas must allow
     connections from anywhere (`0.0.0.0/0`). The strong password and the single-database user
     are what protect it.
   - *Database → Connect → Drivers*: copy the `mongodb+srv://…` connection string and put the
     user's password in it.
2. **Netlify → Site configuration → Environment variables**, add:
   - `MONGODB_URI` = the connection string
   - `SESSION_SECRET` = a long random string. Generate one with `openssl rand -base64 48`
   - (optional) `MONGODB_DB` = `callsop`
3. **Deploy through Git or the Netlify CLI** (`npx netlify-cli deploy --build --prod`).
   Uploading a zip of `dist/` does **not** include the API function, so the test would show
   "service not available".
4. **Check the API:** open `https://YOUR-SITE/api/health`. You should see
   `{"ok":true,"configured":{"mongo":true,"secret":true}}`.
5. **Create your admin** on your computer. Put `MONGODB_URI` in a local `.env` (copy
   `.env.example`), then run:
   ```
   npm run create-admin -- admin
   ```
   and type a password (4+ characters) at the prompt. The username can be anything. Run it
   again to reset a password.
6. Open `/test/admin`, log in, **Tests → New test**, then in the test **Load built-in 30 questions → Replace all** (or add your own).

### Local development

```
cp .env.example .env        # fill in MONGODB_URI and SESSION_SECRET
npm run dev:api             # the API on http://localhost:8788
npm run dev                 # the site; Vite forwards /api to the API
```

Use a separate database (for example `MONGODB_DB=callsop_dev`) if you do not want to touch the
live one.

### If the website and the API are on different domains
Same-origin is the default and needs nothing. Otherwise set `ALLOWED_ORIGIN` (the website's
origin) on the API and `VITE_API_BASE_URL` (the API's origin) when building the site.

## IP access (who can open the site)

An admin can restrict the whole site (SOP, calculator, test, API) to a list of IP addresses
without touching code: **Test Admin Panel → Access**.

- **Switch:** the filter starts **OFF** (everyone can open the site). Turn it **ON** to allow only
  the listed IPs.
- **List:** add an IP (`203.0.113.7`) or a range (`203.0.113.0/24`), with a label and an optional
  expiry (good for home or mobile IPs that change). IPv6 works too.
- **"Add my IP"** adds the address you are connecting from.
- **No lock-out:** the switch refuses to turn ON unless your own IP is allowed, and the panel will
  not delete the rule that is keeping you in. Ranges wide enough to let in a large part of the
  internet (such as `0.0.0.0/0`) are refused.
- **Always allowed:** the office IPs in `netlify/api/access.js` (and any in the
  `ALWAYS_ALLOWED_IPS` setting) can always get in, even if the list is empty or the database is
  down, so the panel can always be opened to fix things.
- A blocked visitor sees "Access Denied" and their own IP address, to send to an admin.

How it works: `netlify/edge-functions/ip-filter.js` runs before every request. It reads the list
from the API (`/api/edge/access`, protected by the `EDGE_SECRET` setting) and remembers it for a
minute, so a change takes effect within about a minute.

**If the database is down:** the last list it read keeps being used (for up to 24 hours), so listed
IPs still get in and unlisted ones stay out. An edge server that has just started during an outage
has nothing remembered and lets in only the always-allowed IPs. Anything that must never be locked
out belongs in `ALWAYS_ALLOWED_IPS`.

**To activate it**, add one setting in Netlify (Site configuration → Environment variables):
`EDGE_SECRET` = a long random string (`openssl rand -base64 48`). Until it exists the filter does
nothing, exactly as before. Optional: `ALWAYS_ALLOWED_IPS` = comma-separated IPs or ranges.
Then deploy, open **Access**, add your IPs, and turn the switch on.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` | Site: development server / production build |
| `npm run dev:api` | Run the API locally |
| `npm run create-admin -- username` | Create an admin or reset their password |
| `npm run lint` | Lint |
| `npm test` | Run every test (see `tests/README.md`) |
| `npm run analyze` | Build and open the bundle-size report (`stats.html`) |
