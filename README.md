# CallSOP

Call-agent tools: the Standard Call Procedure, an Income & Expenditure calculator and a
proctored MCQ test with an admin panel.

## MCQ test

- **Agents** open `/test`, type their name (required) and press **Start Test**. No login.
- **Admins** sign in at `/test/admin` (email + password) to add, edit, import and reorder
  questions, change the pass mark, open/close the test, and watch results and warnings.

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
- Everything sits behind the existing IP allowlist (`netlify/edge-functions/ip-filter.js`).

The admin sees each test by the agent's name, a test number (#1, #2, …) and the start time.
Retakes are unlimited; an admin can delete a test from the **Attempts** tab.

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
6. Open `/test/admin`, log in, then **Questions → Load built-in 30 questions → Replace all**.

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

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `npm run build` | Site: development server / production build |
| `npm run dev:api` | Run the API locally |
| `npm run create-admin -- username` | Create an admin or reset their password |
| `npm run lint` | Lint |
| `npm test` | Run every test (see `tests/README.md`) |
| `npm run analyze` | Build and open the bundle-size report (`stats.html`) |
