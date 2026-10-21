# Local validation

Run the offline Worker/model suite from the repository root:

```
node --test tests/worker.test.mjs tests/calendar.test.mjs
```

For browser integration, make Playwright available to Node, install its Chromium
browser, then run `node tests/browser-check.cjs`. On a machine with Edge instead,
set `NICHI_BROWSER_CHANNEL=msedge`. No production credentials are required.
The harness freezes date calculations to October 2026, hosts local static files,
routes Worker requests to an in-memory KV, and blocks other external requests.
It checks the Cockpit-to-calendar save round trip, preserving daytime/evening,
320/390/1440px rendering, language switching/persistence, plain-text handling,
PNG dimensions and missing-data behavior. Images go to the OS temporary folder
under `nichinichi-browser-check`, not the repository.

Review both exports visually; long activity descriptions appear in the public
date detail and the generated Instagram caption. The compact image uses event
markers/types; A4 also includes an event detail block. This avoids cramming
unbounded free text into date squares. Existing deleted past records cannot be
recovered; there is no past-month event archive.
