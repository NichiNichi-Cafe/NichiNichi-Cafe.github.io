# Local validation

Run the offline Worker/model suite from the repository root:

```
node --test tests/worker.test.mjs tests/calendar.test.mjs tests/caption.test.mjs
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

Export controls are visible only at /kalender/?export. The regular public page
hides downloads and caption tools. The browser suite also tests missing/stale
shared scripts, exception editing/deletion and keyboard skip-link focus.

Review both exports visually; long activity descriptions appear in the public
date detail and the generated Instagram caption. The compact image uses event
markers/types; A4 also includes a concise special-evenings overview. This avoids cramming
unbounded free text into date squares. Existing deleted past records cannot be
recovered; there is no past-month event archive.

FINAL OW005 export design: columns come from nonempty `weeklyHours` days, in
Monday-first order, with wider gaps across omitted weekdays. The public calendar
stays seven-column. Fixtures explicitly mark Oct 22 special opening, Oct 23
temporary closure and Oct 26 D&D as TEST data. `fixtures/ow002-export.js` freezes
the prior renderer for same-data comparison only; the site never loads it.
The browser harness also writes the seven/five-column side-by-side image at
full resolution and 390px, plus a standalone 390px preview. This is a comparison
comparison evidence, not a production schedule. OW008 caption checks cover
localized dates, one block per date and omission of unchanged non-event slots.
