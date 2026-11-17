# Tests

```
npm test
```

Starts a throwaway MongoDB, the API and a build of the site, runs every suite, and
shuts everything down. Takes a few minutes. Your `dist/` folder and your real database
are never touched.

| Suite | What it checks |
|---|---|
| `api.test.mjs` | The API against a real MongoDB: the answer key never reaches agents, scoring, access control, NoSQL injection, login lockout, forged/expired tokens, concurrency |
| `ip-filter.test.mjs` | The Netlify IP allowlist (IPv4, IPv6, ranges) |
| `app.e2e.cjs` | SOP wizard, report, rebuttals dialog, calculator, navigation (Playwright) |
| `mcq.e2e.cjs` | MCQ test and admin panel end to end |
| `mcq-extra.e2e.cjs` | Two agents at once, phone width, closed test, admin sessions |

## Requirements
- `playwright-core` with a Chromium. It is found in `~/.cache/ms-playwright`, or set
  `PLAYWRIGHT_CHROMIUM` to a Chrome/Chromium binary, or run
  `npx playwright-core install chromium`.
- No MongoDB needed: an in-memory one is downloaded on the first run (about 80 MB). To use
  your own instead, set `TEST_MONGO_URI`. The tests only ever use databases named
  `callsop_test…` or `callsop_e2e` and refuse to run against anything else.

## Run one suite
Start MongoDB, the API (`npm run dev:api`) and the site (`npm run build` then
`npx vite preview --port 4320`), then for example
`TEST_MONGO_URI=mongodb://127.0.0.1:27017/ node tests/mcq.e2e.cjs`.
`node tests/api.test.mjs` and `node tests/ip-filter.test.mjs` need no servers.

## Not covered
- A real tab switch: browsers under automation do not fire the events, so the warnings are
  tested with simulated `visibilitychange` / `blur` events. Try it by hand once.
- Netlify itself (routing of `/api/*`, the function bundle): see the README deploy checks.
